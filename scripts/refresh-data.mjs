/**
 * ISP M&A Data Refresh Script
 *
 * Queries public sources for new ISP M&A deals and appends them to deals.js.
 * Run via: npm run refresh-data
 *
 * Sources:
 *   1. NewsAPI.org (requires free API key at newsapi.org)
 *   2. SEC EDGAR full-text search (no key required)
 *
 * Setup:
 *   export NEWS_API_KEY=your_key_here
 *   npm run refresh-data
 */

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEALS_PATH = join(__dirname, '../src/data/deals.js')

const ISP_KEYWORDS = [
  'ISP acquisition', 'broadband merger', 'fiber acquisition', 'cable acquisition',
  'telecom merger', 'ILEC acquisition', 'MSO merger', 'internet provider acquisition',
  'broadband deal', '5G acquisition', 'fiber broadband deal',
]

async function fetchNewsAPIDeals(apiKey) {
  const query = encodeURIComponent(ISP_KEYWORDS.slice(0, 4).join(' OR '))
  const url = `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${apiKey}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`NewsAPI error: ${res.status}`)
  const data = await res.json()
  return data.articles || []
}

async function fetchEdgarFilings() {
  // Search SEC EDGAR for 8-K/SC-TO-T filings mentioning ISP M&A
  const url = 'https://efts.sec.gov/LATEST/search-index?q=%22broadband%22+%22merger%22+%22acquisition%22&dateRange=custom&startdt=2024-01-01&forms=8-K,SC-TO-T&hits.hits._source.period_of_report=true'
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'ISP-MnA-Tracker tony@tristellium.com' } })
    if (!res.ok) return []
    const data = await res.json()
    return (data.hits?.hits || []).slice(0, 10).map(h => ({
      title: h._source?.display_names?.join(' + ') || h._source?.entity_name || 'SEC Filing',
      description: `SEC ${h._source?.form_type} filing: ${h._source?.file_date}`,
      url: `https://www.sec.gov/Archives/edgar/data/${h._source?.entity_id}`,
      publishedAt: h._source?.file_date,
      source: { name: 'SEC EDGAR' },
    }))
  } catch {
    return []
  }
}

async function main() {
  console.log('ISP M&A Tracker — Data Refresh\n')

  const newsApiKey = process.env.NEWS_API_KEY
  const articles = []

  // NewsAPI
  if (newsApiKey) {
    console.log('Fetching from NewsAPI...')
    try {
      const news = await fetchNewsAPIDeals(newsApiKey)
      articles.push(...news)
      console.log(`  Found ${news.length} articles`)
    } catch (e) {
      console.warn(`  NewsAPI failed: ${e.message}`)
    }
  } else {
    console.log('  Skipping NewsAPI (set NEWS_API_KEY env var to enable)')
  }

  // SEC EDGAR
  console.log('Fetching from SEC EDGAR...')
  try {
    const filings = await fetchEdgarFilings()
    articles.push(...filings)
    console.log(`  Found ${filings.length} relevant filings`)
  } catch (e) {
    console.warn(`  EDGAR failed: ${e.message}`)
  }

  if (articles.length === 0) {
    console.log('\nNo new items found. Set NEWS_API_KEY for richer results.')
    return
  }

  console.log('\n--- Potential New Deals ---')
  articles.forEach((a, i) => {
    console.log(`\n[${i + 1}] ${a.title}`)
    console.log(`    ${a.description?.slice(0, 120) || ''}`)
    console.log(`    Published: ${a.publishedAt?.slice(0, 10)} | Source: ${a.source?.name}`)
    console.log(`    URL: ${a.url}`)
  })

  console.log(`\n--- Next Steps ---`)
  console.log('Review the items above, then manually add confirmed deals to:')
  console.log('  src/data/deals.js')
  console.log('\nDeal template:')
  console.log(`
{
  id: "deal-XXX",
  date: "YYYY-MM-DD",
  status: "Completed",           // or "Pending / Regulatory Review"
  dealType: "Acquisition",       // Acquisition | Merger | Asset Acquisition | Joint Venture
  acquirer: {
    name: "",
    type: "",                    // MSO (Cable) | MNO (Wireless) | Pure Fiber (FTTH) | etc.
    ticker: null,                // or "CMCSA"
    pe: null,                    // or { firm, firmType, aum, primaryFunds[], otherTelecomPortfolio[], headquarters }
  },
  acquired: { /* same shape */ },
  dealValue: 0,                  // in dollars
  ownershipPct: 100,
  geography: [],                 // state abbreviations or country names
  subscribers: null,
  reason: "",
  strategicImportance: "",
  keyTerms: "",
  notes: "",
}
  `)
}

main().catch(e => { console.error(e); process.exit(1) })
