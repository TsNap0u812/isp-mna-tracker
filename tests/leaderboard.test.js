import { describe, it, expect } from 'vitest'
import { db, partyName } from '../src/data/db.js'
import { buildLeaderboard } from '../src/components/AnalyticsPage.jsx'

describe('leaderboard source data', () => {
  it('has no compound buyer names — JV deals appear as individual parties', () => {
    const buyerNames = new Set(
      db.participants.filter(p => p.role === 'buyer').map(p => partyName(p)))
    for (const n of buyerNames) {
      expect(n).not.toMatch(/\s\+\s/)
      expect(n).not.toMatch(/\s\/\s/)
    }
  })
  it('splits JV capital by fractional pct', () => {
    const jv = db.participants.filter(p => p.role === 'buyer' && p.pct != null && p.pct < 1)
    expect(jv.length).toBeGreaterThan(0)
    for (const p of jv) expect(p.pct).toBeLessThanOrEqual(0.5)
  })
})

describe('buildLeaderboard', () => {
  const rows = buildLeaderboard()
  it('returns at most 12 rows sorted by value', () => {
    expect(rows.length).toBeLessThanOrEqual(12)
    for (let i = 1; i < rows.length; i++) expect(rows[i-1].value).toBeGreaterThanOrEqual(rows[i].value)
  })
  it('contains no compound rows', () => {
    expect(rows.every(r => !/\s\+\s/.test(r.name))).toBe(true)
  })
  it('every row carries drilldown deal ids', () => {
    expect(rows.every(r => r.dealIds.size >= 1)).toBe(true)
  })
})
