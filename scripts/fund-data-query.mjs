/**
 * fund-data-query.mjs
 *
 * Queries public sources to populate PE fund-level data for the ISP M&A tracker.
 *
 * Sources queried automatically:
 *   1. SEC EDGAR EFTS — Form D fund-raise filings (efts.sec.gov)
 *   2. SEC EDGAR IAPD — Form ADV AUM & fund count (api.adviserinfo.sec.gov)
 *   3. CalPERS PE Fund Performance — HTML table (calpers.ca.gov)
 *
 * Reference URLs surfaced (manual retrieval):
 *   4. WSIB (Washington State Investment Board) — quarterly PDF
 *   5. Oregon State Treasury — alternative investments page
 *   6. Rhode Island Treasury — GP fund performance dataset
 *   7. TRS Texas — quarterly investment report PDF
 *   8. Preqin AWS Marketplace — infrastructure LP-side free data
 *
 * Output:
 *   src/data/fund-data.json
 *
 * Usage:
 *   node scripts/fund-data-query.mjs
 *   node scripts/fund-data-query.mjs --dry-run     # skip API calls, write template only
 *   node scripts/fund-data-query.mjs --firm "KKR"  # only query a single firm
 *
 * Rate limits enforced:
 *   SEC EDGAR: max 10 req/sec — this script caps at 6/sec
 *   IAPD:      max ~5 req/sec (undocumented) — this script caps at 4/sec
 *
 * Environment variables (optional):
 *   EDGAR_USER_AGENT   Override the User-Agent sent to SEC (default: ISP-MnA-Tracker)
 *   CALPERS_TIMEOUT    CalPERS fetch timeout ms (default: 15000)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEALS_PATH     = join(__dirname, '../src/data/deals.json')
const OUTPUT_PATH    = join(__dirname, '../src/data/fund-data.json')
const OVERRIDES_PATH = join(__dirname, 'fund-overrides.json')

// ── CLI flags ─────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const DRY_RUN     = argv.includes('--dry-run')
const FIRM_FILTER = (() => { const i = argv.indexOf('--firm'); return i !== -1 ? argv[i + 1] : null })()
const VERBOSE     = argv.includes('--verbose') || argv.includes('-v')

// ── Constants ─────────────────────────────────────────────────────────────────

const EDGAR_UA    = process.env.EDGAR_USER_AGENT || 'ISP-MnA-Tracker fund-data-query/1.0 (contact@tristellium.com)'
const EDGAR_DELAY = 170   // ms between EDGAR requests (~6/sec)
const IAPD_DELAY  = 250   // ms between IAPD requests (~4/sec)
const CALPERS_TIMEOUT = Number(process.env.CALPERS_TIMEOUT || 15000)

// ── Static LP portal reference table ─────────────────────────────────────────
// These URLs require manual download/parsing (PDFs or authenticated portals).
// The script records them as references; a human must retrieve the data.

const LP_PORTAL_REFS = [
  {
    name: 'CalPERS PE Fund Performance',
    type: 'html-table',
    url: 'https://www.calpers.ca.gov/investments/about-investment-office/investment-organization/pep-fund-performance',
    cadence: 'Quarterly',
    notes: 'Public HTML table. IRR, TVPI, committed capital by fund name. Best available free source.',
    autoScraped: true,
  },
  {
    name: 'WSIB Quarterly Investment Report',
    type: 'pdf',
    url: 'https://www.sib.wa.gov/information/publications/quarterly-reports',
    urlTemplate: 'https://www.sib.wa.gov/docs/reports/quarterly/ir{MMDDYY}.pdf',
    cadence: 'Quarterly',
    notes: 'PDF, ~200 pages. Private markets section lists fund names, committed $ and market value. Look for "Private Equity" and "Infrastructure" appendix tables.',
    autoScraped: false,
  },
  {
    name: 'Oregon Treasury Alternative Investments',
    type: 'pdf',
    url: 'https://www.oregon.gov/treasury/invested-for-oregon/pages/performance-holdings.aspx',
    cadence: 'Quarterly',
    notes: 'Lists fund vintage, committed capital, called capital, distributions, NAV. One of the best US LP sources for infrastructure fund detail.',
    autoScraped: false,
  },
  {
    name: 'Rhode Island State Treasury',
    type: 'html+pdf',
    url: 'https://treasury.ri.gov/investment/investment-information/fund-performance',
    cadence: 'Quarterly',
    notes: 'Fund-level TVPI and DPI available. Search for specific GP names.',
    autoScraped: false,
  },
  {
    name: 'TRS Texas Quarterly Investment Report',
    type: 'pdf',
    url: 'https://www.trs.texas.gov/Pages/fund_investments.aspx',
    cadence: 'Quarterly',
    notes: 'Massive LP. Private Infrastructure and Private Equity sections show committed/market value.',
    autoScraped: false,
  },
  {
    name: 'Preqin AWS Marketplace (Infrastructure Investors)',
    type: 'api',
    url: 'https://aws.amazon.com/marketplace/pp/prodview-x4xjrxtjv5xho',
    cadence: 'Quarterly',
    notes: 'Free AWS Marketplace dataset. LP-side infrastructure investor profiles. Not fund-level GP data, but useful for commitment cross-reference.',
    autoScraped: false,
  },
  {
    name: 'SEC EDGAR Form D Bulk Data',
    type: 'tsv-zip',
    urlTemplate: 'https://www.sec.gov/files/structureddata/data/form-d-data-sets/{YEAR}q{Q}_d.zip',
    cadence: 'Quarterly',
    notes: 'Six TSV files: OFFERING.tsv has totalOfferingAmount and totalAmountSold per filing. SUBMITTER.tsv has filer name. Best for tracking fund closes and raise amounts. Use accessionNumber to cross-reference.',
    autoScraped: true,  // EFTS search done; bulk download requires streaming
  },
]

// ── Firm normalization ────────────────────────────────────────────────────────
// Handles compound/joint entries like "Madison Dearborn + Catania" or "KKR / Ares"

function extractFirmNames(rawName) {
  if (!rawName) return []
  // Split on common joiners but not inside parentheses
  const parts = rawName
    .split(/\s*(?:\+|\/(?!Inc|LLC|LP|Co\b)|&(?!\s+Co))\s*/)
    .map(s => s.trim())
    .filter(Boolean)
  return parts
}

// Canonical lookup name for a firm (strip legal suffixes for search)
function searchName(firm) {
  return firm
    .replace(/\b(LLC|LP|LLP|Inc\.?|Ltd\.?|Group|Management|Capital|Partners|Co\.?|Infrastructure|Asset\s+Management)\b/gi, '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 3)
    .join(' ')
}

// ── Rate-limited fetch wrappers ───────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

let _lastEdgarFetch = 0
async function edgarFetch(url, retries = 2) {
  const now = Date.now()
  const wait = EDGAR_DELAY - (now - _lastEdgarFetch)
  if (wait > 0) await sleep(wait)
  _lastEdgarFetch = Date.now()

  let lastError
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await sleep(500 + attempt * 300)  // progressive back-off for retries
      _lastEdgarFetch = Date.now()
    }
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': EDGAR_UA, 'Accept': 'application/json' },
        signal: AbortSignal.timeout(12000),
      })
      if (res.status === 500 || res.status === 503) {
        lastError = new Error(`EDGAR HTTP ${res.status}: ${url}`)
        continue  // retry on server error
      }
      if (!res.ok) throw new Error(`EDGAR HTTP ${res.status}: ${url}`)
      return await res.json()
    } catch (e) {
      lastError = e
      if (attempt < retries) continue
    }
  }
  throw lastError
}

let _lastIapdFetch = 0
async function iapdFetch(url) {
  const now = Date.now()
  const wait = IAPD_DELAY - (now - _lastIapdFetch)
  if (wait > 0) await sleep(wait)
  _lastIapdFetch = Date.now()

  const res = await fetch(url, {
    headers: { 'User-Agent': EDGAR_UA, 'Accept': 'application/json' },
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) throw new Error(`IAPD HTTP ${res.status}: ${url}`)
  return res.json()
}

// ── Source 1: SEC EDGAR Form D ────────────────────────────────────────────────
// Form D is filed when a fund raises capital from private investors.
// Each filing includes: offering amount, amount sold, entity name, filing date.

async function queryFormD(firmName, fetchAmounts = false) {
  const q = encodeURIComponent(`"${searchName(firmName)}"`)
  const url = `https://efts.sec.gov/LATEST/search-index?q=${q}&forms=D&dateRange=custom&startdt=2018-01-01`

  if (VERBOSE) console.log(`    EDGAR Form D: ${url}`)

  const data = await edgarFetch(url)
  const hits = data?.hits?.hits ?? []

  const filings = hits.slice(0, 20).map(h => {
    const src = h._source ?? {}
    const cik       = src.ciks?.[0] ? parseInt(src.ciks[0]) : null
    const adsh      = src.adsh ?? null   // e.g. "0001810258-22-000001"
    const formType  = src.form ?? src.root_forms?.[0] ?? 'D'

    // Reconstruct URLs from CIK + accession number
    const xmlUrl = cik && adsh
      ? `https://www.sec.gov/Archives/edgar/data/${cik}/${adsh.replace(/-/g, '')}/primary_doc.xml`
      : null
    const filingUrl = cik
      ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=D&dateb=&owner=include&count=10`
      : null

    return {
      entityName:  (src.display_names ?? []).join(', ') || null,
      cik,
      adsh,
      filingDate:  src.file_date ?? null,
      formType,
      isAmendment: formType === 'D/A',
      xmlUrl,
      filingUrl,
      // populated later if fetchAmounts=true
      totalOfferingAmount: null,
      totalAmountSold:     null,
      numberOfInvestors:   null,
    }
  })

  // Optionally fetch offering amounts from XML.
  // Use D/A amendments (not root D) because initial Form D filings have
  // yetToOccur=true and totalOfferingAmount="Indefinite". The latest D/A
  // for each fund contains the actual amount sold after the fund closes.
  if (fetchAmounts) {
    const rootFilings = filings.filter(f => f.xmlUrl).slice(0, 7)
    for (const filing of rootFilings) {
      try {
        await sleep(EDGAR_DELAY)
        if (VERBOSE) console.log(`    EDGAR XML: ${filing.xmlUrl}`)
        const res = await fetch(filing.xmlUrl, {
          headers: { 'User-Agent': EDGAR_UA },
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) continue
        const xml = await res.text()
        const grabNum = (tag) => {
          const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'))
          if (!m) return null
          const val = m[1].replace(/,/g, '').trim()
          if (val.toLowerCase() === 'indefinite' || val === '') return null
          const n = parseFloat(val)
          return isNaN(n) ? null : (n === 0 ? null : n)  // skip 0 (not yet raised)
        }
        const yetToOccur = xml.includes('<yetToOccur>true</yetToOccur>')
        if (!yetToOccur) {
          filing.totalOfferingAmount = grabNum('totalOfferingAmount')
          filing.totalAmountSold     = grabNum('totalAmountSold')
          filing.numberOfInvestors   = grabNum('totalNumberAlreadyInvested')
        }
      } catch (e) {
        if (VERBOSE) console.warn(`    XML fetch failed: ${e.message}`)
      }
    }
  }

  return filings
}

// Fetch actual offering amounts from a Form D primary XML document.
// accessionNo format: "0001234567-24-000123" → "000123456724000123"
async function edgarFetchFormDDetail(cik, accessionNo) {
  if (!cik || !accessionNo) return null
  const acc = accessionNo.replace(/-/g, '')
  const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${acc}/primary_doc.xml`
  if (VERBOSE) console.log(`    EDGAR FormD XML: ${url}`)

  const res = await fetch(url, {
    headers: { 'User-Agent': EDGAR_UA },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) return null
  const xml = await res.text()

  // Parse key fields from XML (simple regex — no DOM dependency)
  const grab = (tag) => {
    const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'))
    return m ? m[1].trim() : null
  }
  const grabNum = (tag) => {
    const v = grab(tag)
    return v ? parseFloat(v.replace(/,/g, '')) : null
  }

  return {
    totalOfferingAmount: grabNum('totalOfferingAmount'),
    totalAmountSold:     grabNum('totalAmountSold'),
    numberOfInvestors:   grabNum('totalNumberAlreadyInvested'),
    fundName:            grab('nameOfIssuer'),
    dateOfFirstSale:     grab('dateOfFirstSale'),
    yetToOccur:          xml.includes('<yetToOccur>true</yetToOccur>'),
  }
}

// ── Source 2: SEC EDGAR IAPD (Form ADV) ──────────────────────────────────────
// The Investment Adviser Public Disclosure system tracks RIAs.
// Provides: total AUM, private fund count, CRD number.

async function queryIAPD(firmName) {
  // IAPD covers SEC-registered investment advisers (Form ADV filers).
  // Many PE fund GPs register as Exempt Reporting Advisers (ERA) or register
  // under a different legal entity name. The search may return 0 results for
  // firms that are ERAs or non-US advisers — this is expected, not an error.

  const q = encodeURIComponent(searchName(firmName))
  const searchUrl = `https://api.adviserinfo.sec.gov/search/firm/results?query=${q}&start=0&rows=8`
  if (VERBOSE) console.log(`    IAPD search: ${searchUrl}`)

  const searchData = await iapdFetch(searchUrl)
  const hits = searchData?.hits?.hits ?? []

  if (hits.length === 0) {
    // Also try ERA-specific search
    try {
      await sleep(IAPD_DELAY)
      const eraUrl = `https://api.adviserinfo.sec.gov/search/era/results?query=${q}&start=0&rows=5`
      if (VERBOSE) console.log(`    IAPD ERA search: ${eraUrl}`)
      const eraData = await iapdFetch(eraUrl)
      const eraHits = eraData?.hits?.hits ?? []
      if (eraHits.length === 0) return null
      hits.push(...eraHits)
    } catch {
      return null
    }
  }

  // Pick the best match: prefer exact first-word overlap
  const firstWord = searchName(firmName).split(' ')[0].toLowerCase()
  let best = hits[0]
  for (const h of hits) {
    const hName = (h._source?.org_nm ?? '').toLowerCase()
    if (hName.startsWith(firstWord)) { best = h; break }
  }

  const src = best._source ?? {}
  const crd = src.org_pk ?? null

  let aum = null
  let numFunds = null

  if (crd) {
    await sleep(IAPD_DELAY)
    try {
      // Use /search/firm/{CRD} endpoint (returns iacontent JSON)
      const detailUrl = `https://api.adviserinfo.sec.gov/search/firm/${crd}`
      if (VERBOSE) console.log(`    IAPD detail: ${detailUrl}`)
      const detail = await iapdFetch(detailUrl)
      const detailHit = detail?.hits?.hits?.[0]?._source ?? {}

      // Parse embedded iacontent JSON string
      let ia = {}
      if (detailHit.iacontent) {
        try { ia = JSON.parse(detailHit.iacontent) } catch { /* pass */ }
      }

      // AUM lives in scheduleD → part2 → Part2B items OR basicInformation
      aum = ia?.scheduleDPart2AInfo?.totalAumDollar
         ?? ia?.basicInformation?.totalAum
         ?? null
      numFunds = ia?.scheduleDPart2AInfo?.privateFundCount
              ?? null
    } catch (e) {
      if (VERBOSE) console.warn(`    IAPD detail failed for CRD ${crd}: ${e.message}`)
    }
  }

  return {
    crdNumber: crd,
    firmName:  src.org_nm ?? null,
    status:    src.current_registration_status ?? null,
    aum,
    numPrivateFunds: numFunds,
    advUrl: crd ? `https://adviserinfo.sec.gov/firm/summary/${crd}` : null,
    lastUpdated: src.last_filed_dt ?? null,
  }
}

// ── Source 3: CalPERS PE Fund Performance ────────────────────────────────────
// Publicly available HTML table. Updated quarterly.
// Columns: Fund, Vintage, Committed, Called, Distributions, NAV, TVPI, DPI, IRR

async function queryCalPERS(firmNamesToMatch) {
  const url = 'https://www.calpers.ca.gov/investments/about-investment-office/investment-organization/pep-fund-performance'

  let html
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ISP-MnA-Tracker fund-data-query)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(CALPERS_TIMEOUT),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    html = await res.text()
  } catch (e) {
    return { error: e.message, funds: [] }
  }

  // Parse all table rows (no DOM, use regex on <tr> content)
  const rowMatches = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
  const funds = []

  for (const [, rowContent] of rowMatches) {
    const cells = [...rowContent.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map(([, c]) => c.replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' '))

    if (cells.length < 4) continue

    const fundName = cells[0]
    if (!fundName || fundName.toLowerCase().includes('fund name')) continue  // header row

    // Check if this fund matches any of our firms
    const matched = firmNamesToMatch.find(f =>
      fundName.toLowerCase().includes(searchName(f).toLowerCase().split(' ')[0].toLowerCase())
    )
    if (!matched) continue

    const parseNum = (s) => {
      if (!s) return null
      const n = parseFloat(s.replace(/[$,%()]/g, '').replace(/,/g, '').trim())
      return isNaN(n) ? null : n
    }

    funds.push({
      fundName,
      matchedFirm: matched,
      vintage:     cells[1] ? parseInt(cells[1]) : null,
      committed:   parseNum(cells[2]),   // $M
      called:      parseNum(cells[3]),
      distributions: parseNum(cells[4]),
      nav:         parseNum(cells[5]),
      tvpi:        parseNum(cells[6]),
      dpi:         parseNum(cells[7]),
      irr:         parseNum(cells[8]),   // %
      source: 'CalPERS',
      sourceUrl: url,
    })
  }

  return { funds, lastFetched: new Date().toISOString(), url }
}

// ── Known firm CRD numbers ─────────────────────────────────────────────────────
// To find a CRD: https://adviserinfo.sec.gov/ → search firm name
// Note: Many PE fund GPs file as Exempt Reporting Advisers (ERA) and may not
// appear in the standard IAPD search. The EDGAR EFTS Form D approach is more
// reliable for PE fund data. Populate this map after manual IAPD verification.
//
// Format: { 'Firm name from deals.json': 'CRD_NUMBER' }
// Leave empty until verified — wrong CRDs silently return wrong firms.

const KNOWN_CRDS = {
  // Verified CRDs (add here after confirming at adviserinfo.sec.gov)
  // Example: 'Apollo Global Management': '361988',
}

// ── Fund name → search aliases ────────────────────────────────────────────────
// Some firm names in deals.json won't match their SEC registration name.
// Override here.

const IAPD_SEARCH_ALIAS = {
  'Grain Management LLC':                  'Grain Management',
  'Wren House Infrastructure Management':  'Wren House Infrastructure',
  'Madison Dearborn Partners + Catania Capital Partners': 'Madison Dearborn Partners',
  'Cox Enterprises (Private Family Ownership)':          null,  // family-owned, not an RIA
  'Mediacom (Founder-Owned / Private)':                  null,
  'Fidelity Investments (Colt Owner)':                   null,  // mega-firm, not relevant
  'E8 Partners':                                         'E8 Partners',
  'WaveDivision Capital':                                'WaveDivision Capital',
  'Macquarie Asset Management (MIRA)':                   'Macquarie Infrastructure',
  'EQT Infrastructure / DigitalBridge (co-lead)':        'EQT Infrastructure',
  'DigitalBridge Group / Crestview Partners':             'DigitalBridge',
  'KKR & Co. / Ares Management':                         'KKR',
  'Oak Hill Capital + Pamlico Capital':                   'Oak Hill Capital',
  'Apax Partners / Warburg Pincus / CPPIB Consortium':   'Apax Partners',
  'Elliott Investment Management / Creditor Consortium':  'Elliott Investment',
}

// ── Firm extraction from deals.json ─────────────────────────────────────────

function extractFirmsFromDeals(deals) {
  const firmMap = new Map()

  deals.forEach(deal => {
    const addPE = (pe, role, deal) => {
      if (!pe?.firm) return
      const key = pe.firm

      if (!firmMap.has(key)) {
        firmMap.set(key, {
          firmRaw:       key,
          firmNames:     extractFirmNames(key),  // split compound names
          firmType:      pe.firmType ?? null,
          aumRaw:        pe.aum ?? null,
          primaryFunds:  [...new Set(pe.primaryFunds ?? [])],
          otherPortfolio: pe.otherTelecomPortfolio ?? [],
          headquarters:  pe.headquarters ?? null,
          website:       pe.website ?? null,
          deals: [],
        })
      }

      const entry = firmMap.get(key)

      // Merge primary funds (deals may repeat the same fund names)
      for (const f of (pe.primaryFunds ?? [])) {
        if (!entry.primaryFunds.includes(f)) entry.primaryFunds.push(f)
      }

      // Track deal reference
      if (!entry.deals.find(d => d.id === deal.id)) {
        entry.deals.push({
          id:           deal.id,
          date:         deal.date,
          status:       deal.status,
          dealValue:    deal.dealValue,
          acquirerName: deal.acquirer?.name,
          targetName:   deal.acquired?.name,
          role,
        })
      }
    }

    addPE(deal.acquirer?.pe, 'acquirer', deal)
    addPE(deal.acquired?.pe, 'target',   deal)
  })

  return [...firmMap.values()]
}

// ── Gap analysis ──────────────────────────────────────────────────────────────

function identifyGaps(firmEntry) {
  const gaps = []
  const confidence = { score: 0, notes: [] }

  if (!firmEntry.aumRaw || firmEntry.aumRaw === 'N/A') {
    gaps.push('total AUM unknown')
  } else {
    confidence.score += 10
    confidence.notes.push('AUM from deals.json (self-reported / press)')
  }

  if (!firmEntry.primaryFunds?.length) {
    gaps.push('primary fund names unknown')
  } else {
    confidence.score += 10
  }

  if (!firmEntry.secEdgar?.formD?.length) {
    gaps.push('no Form D filings found (fund raise history unavailable)')
  } else {
    confidence.score += 20
    confidence.notes.push(`${firmEntry.secEdgar.formD.length} Form D filing(s) found on EDGAR`)
  }

  if (!firmEntry.iapd?.crdNumber) {
    gaps.push('not found in IAPD / no CRD number (may not be US-registered RIA)')
  } else {
    confidence.score += 15
    confidence.notes.push(`CRD ${firmEntry.iapd.crdNumber} verified on IAPD`)
    if (firmEntry.iapd.aum) {
      confidence.score += 20
      confidence.notes.push(`AUM $${(firmEntry.iapd.aum / 1e9).toFixed(1)}B from Form ADV`)
    } else {
      gaps.push('Form ADV AUM not parsed (may require full ADV download)')
    }
  }

  if (!firmEntry.calpers?.length) {
    gaps.push('no CalPERS fund match (fund may not be in CalPERS portfolio)')
  } else {
    confidence.score += 25
    confidence.notes.push(`${firmEntry.calpers.length} fund(s) matched in CalPERS`)
  }

  // Key structural gaps always present without paid data
  gaps.push('vintage year (requires fund docs or paid data)')
  gaps.push('committed capital per fund (requires Form D detail or LP disclosure)')
  gaps.push('called capital / dry powder (requires LP portal or fund reporting)')
  gaps.push('non-ISP deployment (requires full fund activity — paid data only)')

  const level = confidence.score >= 50 ? 'medium'
              : confidence.score >= 25 ? 'low'
              : 'very-low'

  return { gaps, confidence: { level, score: confidence.score, notes: confidence.notes } }
}

// ── Manual overrides merge ────────────────────────────────────────────────────
// scripts/fund-overrides.json is a manual-input file merged into each firm entry
// at output-assembly time. Because this script regenerates fund-data.json
// wholesale, manual data (capital structure, web-verified announced fund sizes)
// must live here rather than in fund-data.json itself.
//
// Schema: { "firms": { "<firmRaw>": { capitalType, capitalNote, announcedFunds } } }
//   capitalType    'fund' | 'evergreen' | 'balance-sheet'  (default 'fund')
//   capitalNote    human-readable explanation shown in the UI
//   announcedFunds [{ fundName, sizeUSD, announcedDate, sourceUrl, note }]

/**
 * Pure merge: returns a new firms array where every firm carries capitalType
 * (default 'fund'), plus capitalNote / announcedFunds when overridden.
 * Unknown firmRaw keys in the overrides produce a console.warn, never an error.
 */
export function applyFundOverrides(firms, overrides) {
  const firmOverrides = overrides?.firms ?? {}

  const known   = new Set(firms.map(f => f.firmRaw))
  const unknown = Object.keys(firmOverrides).filter(k => !known.has(k))
  if (unknown.length) {
    console.warn(
      `⚠ fund-overrides: ${unknown.length} firmRaw key(s) do not match any firm and were ignored: ${unknown.join(', ')}`
    )
  }

  return firms.map(firm => {
    const o      = firmOverrides[firm.firmRaw]
    const merged = { ...firm, capitalType: o?.capitalType ?? 'fund' }
    if (o?.capitalNote != null) merged.capitalNote = o.capitalNote
    if (Array.isArray(o?.announcedFunds) && o.announcedFunds.length) {
      merged.announcedFunds = o.announcedFunds.map(f => ({ ...f }))
    }
    return merged
  })
}

function loadFundOverrides() {
  if (!existsSync(OVERRIDES_PATH)) return { firms: {} }
  try {
    return JSON.parse(readFileSync(OVERRIDES_PATH, 'utf8'))
  } catch (e) {
    console.warn(`⚠ fund-overrides: could not parse ${OVERRIDES_PATH}: ${e.message}`)
    return { firms: {} }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║     ISP M&A Tracker — Fund Data Query v1.0          ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  if (DRY_RUN)     console.log('⚠  DRY RUN — skipping all API calls\n')
  if (FIRM_FILTER) console.log(`⚡ FIRM FILTER: "${FIRM_FILTER}"\n`)

  // ── Load deals ──────────────────────────────────────────────────────────────
  const deals = JSON.parse(readFileSync(DEALS_PATH, 'utf8'))
  console.log(`✓ Loaded ${deals.length} deals from deals.json`)

  let firms = extractFirmsFromDeals(deals)
  console.log(`✓ Extracted ${firms.length} unique PE firm entries`)

  if (FIRM_FILTER) {
    firms = firms.filter(f => f.firmRaw.toLowerCase().includes(FIRM_FILTER.toLowerCase()))
    console.log(`  → Filtered to ${firms.length} matching firm(s)`)
  }

  // ── Query EDGAR Form D ──────────────────────────────────────────────────────
  console.log('\n── SEC EDGAR Form D ─────────────────────────────────────')
  const formDResults = new Map()

  if (!DRY_RUN) {
    for (const firm of firms) {
      const primaryName = IAPD_SEARCH_ALIAS[firm.firmRaw] !== undefined
        ? IAPD_SEARCH_ALIAS[firm.firmRaw]
        : firm.firmNames[0]

      if (!primaryName) {
        console.log(`  ⊘ ${firm.firmRaw} — skipped (non-RIA)`)
        formDResults.set(firm.firmRaw, [])
        continue
      }

      try {
        // fetchAmounts=true → follow top 5 root D filings to XML for offering amounts
        const filings = await queryFormD(primaryName, /* fetchAmounts= */ true)
        formDResults.set(firm.firmRaw, filings)
        const withAmounts = filings.filter(f => f.totalOfferingAmount != null).length
        console.log(`  ✓ ${firm.firmRaw} — ${filings.length} Form D filings (${withAmounts} with offering amounts)`)
      } catch (e) {
        console.warn(`  ✗ ${firm.firmRaw} — EDGAR error: ${e.message}`)
        formDResults.set(firm.firmRaw, [])
      }
    }
  } else {
    firms.forEach(f => formDResults.set(f.firmRaw, []))
    console.log('  (skipped — dry run)')
  }

  // ── Query IAPD ──────────────────────────────────────────────────────────────
  console.log('\n── SEC IAPD (Form ADV) ──────────────────────────────────')
  const iapdResults = new Map()

  if (!DRY_RUN) {
    for (const firm of firms) {
      const alias = IAPD_SEARCH_ALIAS[firm.firmRaw]
      const searchFor = alias !== undefined
        ? alias  // may be null → skip
        : firm.firmNames[0]

      if (!searchFor) {
        console.log(`  ⊘ ${firm.firmRaw} — skipped (non-RIA or no alias)`)
        iapdResults.set(firm.firmRaw, null)
        continue
      }

      // Use known CRD to speed up lookup if available (verify CRDs at adviserinfo.sec.gov)
      if (KNOWN_CRDS[firm.firmRaw] || KNOWN_CRDS[firm.firmNames[0]]) {
        const crd = KNOWN_CRDS[firm.firmRaw] || KNOWN_CRDS[firm.firmNames[0]]
        try {
          await sleep(IAPD_DELAY)
          const detailUrl = `https://api.adviserinfo.sec.gov/search/firm/${crd}`
          const detail    = await iapdFetch(detailUrl)
          const detailHit = detail?.hits?.hits?.[0]?._source ?? {}
          let ia = {}
          if (detailHit.iacontent) { try { ia = JSON.parse(detailHit.iacontent) } catch { /* pass */ } }
          iapdResults.set(firm.firmRaw, {
            crdNumber:       crd,
            firmName:        ia?.basicInformation?.firmName ?? firm.firmNames[0],
            status:          ia?.basicInformation?.firmStatus ?? null,
            aum:             ia?.scheduleDPart2AInfo?.totalAumDollar ?? null,
            numPrivateFunds: ia?.scheduleDPart2AInfo?.privateFundCount ?? null,
            advUrl:          `https://adviserinfo.sec.gov/firm/summary/${crd}`,
            source:          'IAPD (pre-seeded CRD)',
          })
          console.log(`  ✓ ${firm.firmRaw} — CRD ${crd} (pre-seeded)`)
        } catch (e) {
          console.warn(`  ✗ ${firm.firmRaw} — IAPD CRD lookup failed: ${e.message}`)
          iapdResults.set(firm.firmRaw, null)
        }
      } else {
        try {
          const result = await queryIAPD(searchFor)
          iapdResults.set(firm.firmRaw, result)
          if (result) {
            console.log(`  ✓ ${firm.firmRaw} — CRD ${result.crdNumber} (${result.firmName})`)
          } else {
            console.log(`  ⊘ ${firm.firmRaw} — no IAPD match for "${searchFor}"`)
          }
        } catch (e) {
          console.warn(`  ✗ ${firm.firmRaw} — IAPD error: ${e.message}`)
          iapdResults.set(firm.firmRaw, null)
        }
      }
    }
  } else {
    firms.forEach(f => iapdResults.set(f.firmRaw, null))
    console.log('  (skipped — dry run)')
  }

  // ── Query CalPERS ────────────────────────────────────────────────────────────
  console.log('\n── CalPERS PE Fund Performance ──────────────────────────')
  let calPERSResult = { funds: [], error: null }

  if (!DRY_RUN) {
    try {
      // Build de-duped name list for CalPERS matching.
      // Skip non-PE-fund entries (family-owned, non-fund owners) and filter
      // out sub-names that are too short or generic (e.g. "Private)" from
      // extractFirmNames splitting "Mediacom (Founder-Owned / Private)").
      const CALPERS_SKIP = new Set([
        'Cox Enterprises (Private Family Ownership)',
        'Mediacom (Founder-Owned / Private)',
        'Fidelity Investments (Colt Owner)',
        'E8 Partners',
      ])
      const GENERIC_TOKENS = new Set(['private)', 'private', 'inc.', 'llc', 'lp', 'co-lead)'])
      const allNames = [
        ...new Set(
          firms
            .filter(f => !CALPERS_SKIP.has(f.firmRaw))
            .flatMap(f => [f.firmRaw, ...f.firmNames])
            .filter(n => n && n.trim().length >= 5 && !GENERIC_TOKENS.has(n.trim().toLowerCase()))
        ),
      ]
      calPERSResult = await queryCalPERS(allNames)
      if (calPERSResult.error) {
        console.warn(`  ✗ CalPERS fetch failed: ${calPERSResult.error}`)
      } else {
        console.log(`  ✓ ${calPERSResult.funds.length} fund row(s) matched across tracked firms`)
      }
    } catch (e) {
      console.warn(`  ✗ CalPERS unexpected error: ${e.message}`)
      calPERSResult.error = e.message
    }
  } else {
    console.log('  (skipped — dry run)')
  }

  // Group CalPERS matches by firm
  const calpersByFirm = {}
  ;(calPERSResult.funds ?? []).forEach(f => {
    if (!calpersByFirm[f.matchedFirm]) calpersByFirm[f.matchedFirm] = []
    calpersByFirm[f.matchedFirm].push(f)
  })

  // ── Assemble output ──────────────────────────────────────────────────────────
  console.log('\n── Assembling fund-data.json ────────────────────────────')

  const output = {
    _meta: {
      generated:       new Date().toISOString(),
      generatedBy:     'scripts/fund-data-query.mjs',
      dealsFile:       'src/data/deals.json',
      dealCount:       deals.length,
      firmCount:       firms.length,
      queryMode:       DRY_RUN ? 'dry-run' : 'live',
      nextQueryTip:    [
        'Re-run quarterly: node scripts/fund-data-query.mjs',
        'For a single firm: node scripts/fund-data-query.mjs --firm "Stonepeak"',
        'For fund-level detail (committed/called/NAV), see lpPortalRefs below',
        'For paid data: Infralogic (60-day trial), PitchBook, Preqin',
      ],
    },

    lpPortalRefs: LP_PORTAL_REFS,

    // CalPERS data (cross-firm, fetched once)
    calPERS: {
      lastFetched: calPERSResult.lastFetched ?? null,
      error:       calPERSResult.error ?? null,
      fundCount:   calPERSResult.funds?.length ?? 0,
      funds:       calPERSResult.funds ?? [],
    },

    firms: firms.map(firm => {
      const formD   = formDResults.get(firm.firmRaw) ?? []
      const iapd    = iapdResults.get(firm.firmRaw) ?? null
      const calpers = calpersByFirm[firm.firmRaw] ?? []

      const assembled = {
        firmKey:      firm.firmRaw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        firmRaw:      firm.firmRaw,
        firmNames:    firm.firmNames,
        firmType:     firm.firmType,
        headquarters: firm.headquarters,
        website:      firm.website,
        dealCount:    firm.deals.length,

        // From deals.json (self-reported / press sources)
        dealsData: {
          aumRaw:       firm.aumRaw,
          primaryFunds: firm.primaryFunds,
          deals:        firm.deals,
        },

        // From SEC EDGAR Form D
        secEdgar: {
          source:       'SEC EDGAR EFTS full-text search',
          queryUrl:     !DRY_RUN
            ? `https://efts.sec.gov/LATEST/search-index?q="${encodeURIComponent(searchName(firm.firmNames[0] ?? firm.firmRaw))}"&forms=D&dateRange=custom&startdt=2018-01-01`
            : null,
          formD,
          // To get offering amounts, follow accessionNumber to:
          //   https://www.sec.gov/Archives/edgar/data/{cik}/{accno}/primary_doc.xml
          //   Parse <totalOfferingAmount> and <totalAmountSold>
          bulkDownloadNote: [
            'For full fund-raise history with dollar amounts, download quarterly bulk TSV:',
            '  https://www.sec.gov/files/structureddata/data/form-d-data-sets/{YEAR}q{Q}_d.zip',
            '  OFFERING.tsv → columns: accessionNumber, totalOfferingAmount, totalAmountSold, numberOfInvestors',
            '  SUBMITTER.tsv → match by filerName to identify this firm',
          ],
        },

        // From IAPD / Form ADV
        iapd: iapd
          ? { ...iapd, source: 'SEC IAPD (Form ADV)' }
          : {
              crdNumber: null,
              source:    'SEC IAPD',
              note:      IAPD_SEARCH_ALIAS[firm.firmRaw] === null
                ? 'Not an SEC-registered investment adviser (family-owned / corporate acquirer)'
                : 'Not found in IAPD — may be non-US adviser or unregistered',
            },

        // From CalPERS public table
        calpers,

        // Fund-specific data (populated from LP portals / paid data — currently empty)
        fundSpecific: firm.primaryFunds.map(fundName => ({
          fundName,
          vintage:            null,   // e.g. 2021
          targetSizeM:        null,   // $ millions
          finalCloseSizeM:    null,   // $ millions — from Form D totalAmountSold
          calledCapitalPct:   null,   // % called  — from LP portal
          navM:               null,   // $ millions — from LP portal or GP report
          distributionsM:     null,
          dpi:                null,
          tvpi:               null,
          irr:                null,
          sources:            [],
          gaps:               ['vintage', 'size', 'called capital', 'NAV', 'returns'],
        })),

        // Gap analysis
        ...identifyGaps({
          aumRaw: firm.aumRaw,
          primaryFunds: firm.primaryFunds,
          secEdgar: { formD },
          iapd,
          calpers,
        }),
      }

      return assembled
    }),
  }

  // ── Merge manual overrides (scripts/fund-overrides.json) ────────────────────
  const fundOverrides   = loadFundOverrides()
  output.firms          = applyFundOverrides(output.firms, fundOverrides)
  const overrideEntries = Object.keys(fundOverrides.firms ?? {}).length
  output._meta.fundOverrides = {
    file:        'scripts/fund-overrides.json',
    applied:     true,
    appliedAt:   new Date().toISOString().slice(0, 10),
    firmEntries: overrideEntries,
    note:        'Manual capital-structure (capitalType/capitalNote) and web-verified announcedFunds merged at generation time',
  }
  console.log(`  ✓ Merged fund-overrides.json (${overrideEntries} firm entr${overrideEntries === 1 ? 'y' : 'ies'})`)

  // ── Write output ─────────────────────────────────────────────────────────────
  if (DRY_RUN) {
    console.log(`\n⚠  DRY RUN — not writing to ${OUTPUT_PATH} (add data would be empty)`)
    console.log('   Run without --dry-run to execute live queries and write output.')
  } else {
    writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8')
    console.log(`\n✅ Written to ${OUTPUT_PATH}`)
  }

  // ── Print gap summary ─────────────────────────────────────────────────────────
  console.log('\n── Gap Summary ──────────────────────────────────────────')
  const grouped = { 'very-low': [], 'low': [], 'medium': [], 'high': [] }
  output.firms.forEach(f => grouped[f.confidence.level]?.push(f.firmRaw))

  if (grouped.medium.length)    console.log(`  MEDIUM confidence (${grouped.medium.length}): ${grouped.medium.join(', ')}`)
  if (grouped.low.length)       console.log(`  LOW confidence    (${grouped.low.length}): ${grouped.low.join(', ')}`)
  if (grouped['very-low'].length) console.log(`  VERY LOW          (${grouped['very-low'].length}): ${grouped['very-low'].join(', ')}`)

  console.log('\n── Next steps to close data gaps ────────────────────────')
  console.log('  1. EDGAR Form D amounts:')
  console.log('     Download quarterly bulk ZIP (see bulkDownloadNote in each firm\'s secEdgar block)')
  console.log('     Filter SUBMITTER.tsv by firm name → join OFFERING.tsv on accessionNumber')
  console.log('')
  console.log('  2. LP portals (best for fund-specific committed/called capital):')
  LP_PORTAL_REFS.filter(r => !r.autoScraped).forEach(r => {
    console.log(`     • ${r.name}`)
    console.log(`       ${r.url}`)
    console.log(`       ${r.notes.slice(0, 80)}`)
  })
  console.log('')
  console.log('  3. Paid sources (most complete):')
  console.log('     • Infralogic: https://infralogic.com  (60-day free trial available)')
  console.log('     • PitchBook: https://pitchbook.com    (subscription required)')
  console.log('     • Preqin: https://preqin.com          (subscription; AWS Marketplace free tier)')
  console.log('     • S&P Capital IQ: private fund database')
  console.log('')
  console.log('  4. GP public statements:')
  console.log('     • Press releases announcing fund closes (Google: "{FirmName} fund close 2024")')
  console.log('     • Earnings call transcripts for publicly-listed GPs (KKR, Apollo, TPG, Macquarie)')
  console.log('     • IR presentations on GP websites')
  console.log('')
  console.log('  5. Populate fund-data.json manually:')
  console.log('     • Edit src/data/fund-data.json → firms[n].fundSpecific[m]')
  console.log('     • Fields: vintage, finalCloseSizeM, calledCapitalPct, navM, dpi, tvpi, irr')
  console.log('     • Add source citations to the sources[] array')
}

// Only run when executed directly (`node scripts/fund-data-query.mjs`), not when
// imported for its exported helpers (applyFundOverrides) by tests or one-off scripts.
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch(e => {
    console.error('\n✗ Fatal error:', e)
    process.exit(1)
  })
}
