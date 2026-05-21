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
 */

import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = process.env.API_PORT || 3001

// ── XML / RSS helpers ─────────────────────────────────────────────────────────

function extractField(chunk, tag) {
  // Match <tag> or <tag attr="val"> with optional CDATA wrapper
  const r = new RegExp(
    `<${tag}(?:[^>]*)>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`,
    'i'
  )
  return (r.exec(chunk)?.[1] ?? '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;/g, ' ').trim()
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

const ISP_RE  = /broadband|fiber|cable|MSO|MNO|ILEC|CLEC|\bISP\b|internet service|wireless carrier|telecom|spectrum|satellite internet|fixed wireless/i
const MA_RE   = /acqui[rs]|merger|merges|purchas|buyout|take.private|joint venture|divest|takeover|backed by|pe.backed|private equity|recapitali/i

function isRelevant({ title, description }) {
  const text = `${title} ${description}`
  return ISP_RE.test(text) && MA_RE.test(text)
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
    const src = readFileSync(join(__dirname, '../src/data/deals.js'), 'utf8')
    const names = new Set()
    const re = /name:\s*['"]([^'"]{4,})['"],/g
    let m
    while ((m = re.exec(src)) !== null) {
      // Take first two words, lower-cased, for fuzzy matching
      const short = m[1].toLowerCase().split(/\s+/).slice(0, 2).join(' ')
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

// ── Server ────────────────────────────────────────────────────────────────────

const RSS_SOURCES = [
  ['https://www.telecompetitor.com/feed/',           'Telecompetitor'],
  ['https://broadbandbreakfast.com/feed/',            'Broadband Breakfast'],
  ['https://www.fierce-network.com/rss/xml',          'Fierce Network'],
  ['https://www.lightreading.com/rss.xml',            'Light Reading'],
  ['https://arstechnica.com/tag/broadband/feed/',     'Ars Technica'],
  ['https://www.nexttv.com/rss',                      'Next TV'],
]

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
        console.log('  [api] Fetching via RSS feeds...')
        const results = await Promise.all(RSS_SOURCES.map(([u, n]) => fetchRSS(u, n)))
        raw = results.flat()
      }

      let items = raw
        .filter(i => isRelevant(i) && isWithinSixMonths(i.pubDate))

      items = dedupeByTitle(items)

      const existingNames = getExistingNames()
      items = annotateExisting(items, existingNames)

      // New deals first, then already-tracked, both sorted by date desc
      items.sort((a, b) => {
        if (a.alreadyTracked !== b.alreadyTracked) return a.alreadyTracked ? 1 : -1
        return new Date(b.pubDate || 0) - new Date(a.pubDate || 0)
      })

      console.log(`  [api] Returning ${items.length} items (${items.filter(i => !i.alreadyTracked).length} new)`)

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        items: items.slice(0, 30),
        source: newsApiKey ? 'NewsAPI' : 'RSS',
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
