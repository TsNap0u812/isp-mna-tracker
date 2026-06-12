import { describe, it, expect } from 'vitest'
import { deriveStakes } from '../scripts/migrate/stakes.mjs'

const DEALS = [
  { id: 'd-cons', date: '2021-04-01', status: 'Completed', dealType: 'Consolidation', ownershipPct: 100 },
  { id: 'd-sale', date: '2021-08-01', status: 'Completed', dealType: 'Acquisition', ownershipPct: 100 },
  { id: 'd-rumor', date: '2025-01-01', status: 'Pending / Regulatory Review', dealType: 'Merger', ownershipPct: 100 },
]
const PARTS = [
  { dealId: 'd-cons', partyType: 'firm', partyId: 'firm-tpg', role: 'buyer', pct: 1, fundId: null },
  { dealId: 'd-cons', partyType: 'asset', partyId: 'asset-rcn', role: 'target', pct: null, fundId: null },
  { dealId: 'd-cons', partyType: 'asset', partyId: 'asset-wave', role: 'target', pct: null, fundId: null },
  { dealId: 'd-cons', partyType: 'asset', partyId: 'asset-astound', role: 'successor', pct: null, fundId: null },
  { dealId: 'd-sale', partyType: 'firm', partyId: 'firm-stonepeak', role: 'buyer', pct: 1, fundId: null },
  { dealId: 'd-sale', partyType: 'asset', partyId: 'asset-astound', role: 'target', pct: null, fundId: null },
  { dealId: 'd-sale', partyType: 'firm', partyId: 'firm-tpg', role: 'seller', pct: null, fundId: null },
  { dealId: 'd-rumor', partyType: 'asset', partyId: 'asset-astound', role: 'target', pct: null, fundId: null },
]

describe('deriveStakes — Astound chain', () => {
  const { stakes } = deriveStakes(DEALS, PARTS)

  it('consolidation opens the buyer stake on the successor asset', () => {
    const tpg = stakes.find(s => s.ownerId === 'firm-tpg' && s.assetId === 'asset-astound')
    expect(tpg.startDate).toBe('2021-04-01')
    expect(tpg.openedByDealId).toBe('d-cons')
  })

  it('the sale closes the seller stake and opens the buyer stake', () => {
    const tpg = stakes.find(s => s.ownerId === 'firm-tpg' && s.assetId === 'asset-astound')
    expect(tpg.endDate).toBe('2021-08-01')
    expect(tpg.closedByDealId).toBe('d-sale')
    const sp = stakes.find(s => s.ownerId === 'firm-stonepeak')
    expect(sp.assetId).toBe('asset-astound')
    expect(sp.endDate).toBe(null)
    expect(sp.pct).toBe(100)
  })

  it('non-completed deals produce no stakes', () => {
    expect(stakes.some(s => s.openedByDealId === 'd-rumor')).toBe(false)
  })
})

describe('deriveStakes — pre-history synthesis', () => {
  it('synthesizes a seller stake when the asset has no tracked opening', () => {
    const deals = [{ id: 'd1', date: '2021-05-01', status: 'Completed', dealType: 'Acquisition', ownershipPct: 100 }]
    const parts = [
      { dealId: 'd1', partyType: 'firm', partyId: 'firm-buyer', role: 'buyer', pct: 1, fundId: null },
      { dealId: 'd1', partyType: 'asset', partyId: 'asset-x', role: 'target', pct: null, fundId: null },
      { dealId: 'd1', partyType: 'firm', partyId: 'firm-old-owner', role: 'seller', pct: null, fundId: null },
    ]
    const { stakes, flags } = deriveStakes(deals, parts)
    const pre = stakes.find(s => s.ownerId === 'firm-old-owner')
    expect(pre.startDate).toBe(null)
    expect(pre.openedByDealId).toBe(null)
    expect(pre.endDate).toBe('2021-05-01')
    expect(flags.some(f => f.includes('pre-history'))).toBe(true)
  })
})
