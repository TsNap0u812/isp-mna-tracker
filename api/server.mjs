/**
 * ISP M&A Tracker — API Server (port 3001)
 * Proxied by Vite dev server at /api
 *
 * Endpoints:
 *   GET /api/refresh   — scan news sources for ISP M&A activity (past 6 months)
 *   GET /api/health    — liveness check
 *
 * Optional env vars:
 *   NEWS_API_KEY       — newsapi.org free key for richer results (newsapi.org)
 *
 * Sources (from broadband_ma_sources.json):
 *   RSS  — Telecompetitor, Broadband Breakfast, Fierce Network, Light Reading,
 *           Telecom Ramblings, Next TV, NTIA BroadbandUSA
 *   SEC  — EDGAR S-4 (M&A registration statements) + 8-K Items 1.01/2.01
 */

import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = process.env.API_PORT || 3001

// ── XML / RSS helpers (RSS 2.0) ───────────────────────────────────────────────

function extractField(chunk, tag) {
  const r = new RegExp(
    `<${tag}(?:[^>]*)>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`,
    'i'
  )
  return (r.exec(chunk)?.[1] ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, ' ').trim()
}

function parseRSS(xml, sourceName) {
  const items = []
  const re = /<item>([\s\S]*?)<\/item>/gi
  let m
  while ((m = re.exec(xml)) !== null) {
    const chunk = m[1]
    const title       = extractField(chunk, 'title')
    const link        = extractField(chunk, 'link') || extractField(chunk, 'guid')
    const description = extractField(chunk, 'description').slice(0, 400)
    const pubDate     = extractField(chunk, 'pubDate')
    if (title) items.push({ title, link, description, pubDate, sourceName })
  }
  return items
}

async function fetchRSS(url, sourceName) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ISP-MnA-Tracker/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const xml = await res.text()
    return parseRSS(xml, sourceName)
  } catch {
    return []
  }
}

// ── Atom helpers (SEC EDGAR) ──────────────────────────────────────────────────

function parseAtom(xml, sourceName) {
  const items = []
  const re = /<entry>([\s\S]*?)<\/entry>/gi
  let m
  while ((m = re.exec(xml)) !== null) {
    const chunk = m[1]
    const title       = extractField(chunk, 'title')
    const linkMatch   = chunk.match(/<link[^>]+href=["']([^"']+)["']/i)
    const link        = linkMatch?.[1] ?? ''
    const description = (extractField(chunk, 'summary') || extractField(chunk, 'content')).slice(0, 400)
    const pubDate     = extractField(chunk, 'updated') || extractField(chunk, 'published')
    if (title) items.push({ title, link, description, pubDate, sourceName })
  }
  return items
}

async function fetchAtom(url, sourceName) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ISP-MnA-Tracker/1.0)',
        'Accept': 'application/atom+xml, application/xml, */*',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const xml = await res.text()
    return parseAtom(xml, sourceName)
  } catch {
    return []
  }
}

// ── NewsAPI ───────────────────────────────────────────────────────────────────

async function fetchNewsAPI(apiKey) {
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 6)
  const from = cutoff.toISOString().split('T')[0]

  const queries = [
    'ISP acquisition OR merger',
    'broadband fiber acquisition',
    'cable telecom merger deal',
    'internet provider buyout',
  ]

  const all = []
  for (const q of queries) {
    try {
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=en&from=${from}&sortBy=publishedAt&pageSize=15&apiKey=${apiKey}`
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) continue
      const data = await res.json()
      for (const a of data.articles ?? []) {
        if (a.title === '[Removed]') continue
        all.push({
          title: a.title ?? '',
          link: a.url ?? '',
          description: (a.description ?? '').slice(0, 400),
          pubDate: a.publishedAt ?? '',
          sourceName: a.source?.name ?? 'NewsAPI',
        })
      }
    } catch { /* skip */ }
  }
  return all
}

// ── Filtering ─────────────────────────────────────────────────────────────────

// ISP technology / asset-class signals
const ISP_RE = /broadband|fiber|cable|MSO|MNO|ILEC|CLEC|\bISP\b|internet service|wireless carrier|telecom|spectrum|satellite internet|fixed wireless|\bFTTH\b|\bFTTP\b|\bHFC\b|\bFWA\b/i

// M&A action signals — extended with terms from broadband_ma_sources.json deal_keywords
const MA_RE = /acqui[rs]|merger|merges|purchas|buyout|take.private|joint venture|divest|takeover|backed by|pe.backed|private equity|recapitali|definitive agreement|carve.out|sale of|to be acquired|going private/i

// Known ISP / telecom company names — used to filter SEC EDGAR filings
const TELECOM_COS_RE = /charter comm|comcast|\bverizon\b|\bat&t\b|\bt-mobile\b|frontier comm|lumen tech|kinetic by wind|cox comm|cox cable|altice|mediacom|sparklight|cable one|consolidated comm|wide.?open.?west|\bwow\b|astound|brightspeed|ziply|windstream|centurylink|shentel|metronet|dish network|echostar|directv|\bzayo\b|uniti group|lumos|great plains comm|calix|swyft|aca conn|\bntca\b|\bclec\b|wren house|stonepeak|grain management|eqt infra|\bkkr\b/i

// SEC 8-K item numbers relevant to M&A (material agreements / completed acquisitions)
const SEC_MA_ITEM_RE = /item\s+1\.01|item\s+2\.01/i

function isRelevant({ title, description }) {
  const text = `${title} ${description}`
  return ISP_RE.test(text) && MA_RE.test(text)
}

function isSecRelevant({ title, description, sourceName }) {
  const text = `${title} ${description}`
  if (!TELECOM_COS_RE.test(text)) return false
  // S-4 is inherently an M&A filing; just verify the company is telecom
  if (sourceName === 'SEC EDGAR (S-4)') return true
  // 8-K: also require M&A-specific item numbers
  return SEC_MA_ITEM_RE.test(text)
}

function isWithinSixMonths(dateStr) {
  if (!dateStr) return true
  try {
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - 6)
    return new Date(dateStr) >= cutoff
  } catch { return true }
}

// ── Deduplication ─────────────────────────────────────────────────────────────

function getExistingNames() {
  try {
    const readDb = f => JSON.parse(readFileSync(join(__dirname, '../src/data/db', f), 'utf8'))
    const assets = readDb('assets.json')
    const firms  = readDb('firms.json')
    const deals  = readDb('deals.json')

    // Names + aliases from entities, plus display names from deals —
    // a richer dedupe vocabulary than the legacy snapshot alone.
    const rawNames = [
      ...assets.flatMap(a => [a.name, ...(a.aliases ?? [])]),
      ...firms.flatMap(f => [f.name, ...(f.aliases ?? [])]),
      ...deals.flatMap(d => [d.display?.acquirerName, d.display?.acquiredName]),
    ]

    const names = new Set()
    for (const party of rawNames) {
      if (!party || party.length < 4) continue
      const short = party.toLowerCase().split(/\s+/).slice(0, 2).join(' ')
      if (short.length > 3) names.add(short)
    }
    return [...names]
  } catch { return [] }
}

function dedupeByTitle(items) {
  const seen = new Set()
  return items.filter(({ title }) => {
    const key = title.toLowerCase().replace(/\W+/g, ' ').trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function annotateExisting(items, existingNames) {
  return items.map(item => {
    const text = `${item.title} ${item.description}`.toLowerCase()
    const alreadyTracked = existingNames.some(n => n.length > 4 && text.includes(n))
    return { ...item, alreadyTracked }
  })
}

// ── Source lists ──────────────────────────────────────────────────────────────

// Trade press + regulatory RSS feeds (RSS 2.0)
const RSS_SOURCES = [
  // High priority — M&A-focused trade press
  ['https://www.telecompetitor.com/feed/',           'Telecompetitor'],
  ['https://www.telecomramblings.com/feed/',          'Telecom Ramblings'],
  ['https://www.fierce-network.com/rss/xml',          'Fierce Network'],
  // Medium priority — policy and broader telecom coverage
  ['https://broadbandbreakfast.com/feed/',            'Broadband Breakfast'],
  ['https://www.lightreading.com/rss.xml',            'Light Reading'],
  ['https://broadbandusa.ntia.gov/rss.xml',           'NTIA BroadbandUSA'],
  // Lower priority — cable / video distribution
  ['https://www.nexttv.com/rss',                      'Next TV'],
]

// SEC EDGAR primary regulatory feeds (Atom)
const SEC_SOURCES = [
  // S-4: registration statement for securities issued in mergers — strong M&A leading indicator
  ['https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=S-4&dateb=&owner=include&count=40&output=atom', 'SEC EDGAR (S-4)'],
  // 8-K: material events — Items 1.01 (definitive agreements) and 2.01 (completed acquisitions)
  ['https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&dateb=&owner=include&count=100&output=atom', 'SEC EDGAR (8-K)'],
]

// ── Server ────────────────────────────────────────────────────────────────────

createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  const url = new URL(req.url, `http://localhost:${PORT}`)

  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return
  }

  if (url.pathname === '/api/refresh') {
    try {
      const newsApiKey = process.env.NEWS_API_KEY
      let raw = []

      if (newsApiKey) {
        console.log('  [api] Fetching via NewsAPI...')
        raw = await fetchNewsAPI(newsApiKey)
      } else {
        console.log('  [api] Fetching via RSS + SEC EDGAR...')
        const [rssResults, secResults] = await Promise.all([
          Promise.all(RSS_SOURCES.map(([u, n]) => fetchRSS(u, n))),
          Promise.all(SEC_SOURCES.map(([u, n]) => fetchAtom(u, n))),
        ])
        raw = [...rssResults.flat(), ...secResults.flat()]
      }

      // Apply source-appropriate relevance filter
      let items = raw.filter(i => {
        if (!isWithinSixMonths(i.pubDate)) return false
        return i.sourceName?.startsWith('SEC EDGAR')
          ? isSecRelevant(i)
          : isRelevant(i)
      })

      items = dedupeByTitle(items)

      const existingNames = getExistingNames()
      items = annotateExisting(items, existingNames)

      // New deals first, then already-tracked, both sorted by date desc
      items.sort((a, b) => {
        if (a.alreadyTracked !== b.alreadyTracked) return a.alreadyTracked ? 1 : -1
        return new Date(b.pubDate || 0) - new Date(a.pubDate || 0)
      })

      const newCount = items.filter(i => !i.alreadyTracked).length
      console.log(`  [api] Returning ${items.length} items (${newCount} new)`)

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        items: items.slice(0, 40),
        source: newsApiKey ? 'NewsAPI' : 'RSS + SEC EDGAR',
        hasApiKey: !!newsApiKey,
        fetchedAt: new Date().toISOString(),
      }))
    } catch (e) {
      console.error('  [api] Error:', e.message)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  res.writeHead(404)
  res.end()
}).listen(PORT, () => {
  console.log(`  ✓  API server → http://localhost:${PORT}`)
})
