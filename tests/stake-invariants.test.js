import { describe, it, expect } from 'vitest'
import { db, openStakes } from '../src/data/db.js'

// No asset may ever be more than 100% owned. Stakes with pct null (unquantified
// pre-history residuals) are excluded from the sum — they carry no percentage.
const TOLERANCE = 100.01

function offenders(stakeList) {
  const sums = new Map()
  for (const s of stakeList) {
    if (s.pct == null) continue
    sums.set(s.assetId, (sums.get(s.assetId) ?? 0) + s.pct)
  }
  return [...sums.entries()]
    .filter(([, sum]) => sum > TOLERANCE)
    .map(([assetId, sum]) => `${assetId}: ${sum}%`)
}

describe('stake invariants — ownership never exceeds 100%', () => {
  it('current open stakes sum to ≤ 100% per asset', () => {
    const bad = offenders(db.stakes.filter(s => s.endDate === null))
    expect(bad, `over-owned assets (open stakes): ${bad.join('; ')}`).toEqual([])
  })

  for (const asOf of ['2021-06-01', '2023-01-01', '2025-06-01']) {
    it(`as-of ${asOf}: active stakes sum to ≤ 100% per asset`, () => {
      const bad = offenders(openStakes(asOf))
      expect(bad, `over-owned assets as of ${asOf}: ${bad.join('; ')}`).toEqual([])
    })
  }
})
