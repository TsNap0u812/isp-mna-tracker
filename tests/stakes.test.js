import { describe, it, expect } from 'vitest'
import { deriveStakes } from '../scripts/migrate/stakes.mjs'

const DEALS = [
  { id: 'd-cons', date: '2021-04-01', status: 'Completed', dealType: 'Consolidation', ownershipPct: 100 },
  { id: 'd-sale', date: '2021-08-01', status: 'Completed', dealType: 'Acquisition', ownershipPct: 100 },
  { id: 'd-rumor', date: '2025-01-01', status: 'Pending / Regulatory Review', dealType: 'Merger', ownershipPct: 100 },
]
const PARTS = [
  { dealId: 'd-cons', partyType: 'firm', partyId: 'firm-tpg', role: 'buyer', pct: 1, fundIds: [] },
  { dealId: 'd-cons', partyType: 'asset', partyId: 'asset-rcn', role: 'target', pct: null, fundIds: [] },
  { dealId: 'd-cons', partyType: 'asset', partyId: 'asset-wave', role: 'target', pct: null, fundIds: [] },
  { dealId: 'd-cons', partyType: 'asset', partyId: 'asset-astound', role: 'successor', pct: null, fundIds: [] },
  { dealId: 'd-sale', partyType: 'firm', partyId: 'firm-stonepeak', role: 'buyer', pct: 1, fundIds: [] },
  { dealId: 'd-sale', partyType: 'asset', partyId: 'asset-astound', role: 'target', pct: null, fundIds: [] },
  { dealId: 'd-sale', partyType: 'firm', partyId: 'firm-tpg', role: 'seller', pct: null, fundIds: [] },
  { dealId: 'd-rumor', partyType: 'asset', partyId: 'asset-astound', role: 'target', pct: null, fundIds: [] },
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
      { dealId: 'd1', partyType: 'firm', partyId: 'firm-buyer', role: 'buyer', pct: 1, fundIds: [] },
      { dealId: 'd1', partyType: 'asset', partyId: 'asset-x', role: 'target', pct: null, fundIds: [] },
      { dealId: 'd1', partyType: 'firm', partyId: 'firm-old-owner', role: 'seller', pct: null, fundIds: [] },
    ]
    const { stakes, flags } = deriveStakes(deals, parts)
    const pre = stakes.find(s => s.ownerId === 'firm-old-owner')
    expect(pre.startDate).toBe(null)
    expect(pre.openedByDealId).toBe(null)
    expect(pre.endDate).toBe('2021-05-01')
    expect(flags.some(f => f.includes('pre-history'))).toBe(true)
  })
})

describe('deriveStakes — partial deals', () => {
  it('leaves prior stakes open, opens fractional buyer stakes, and flags', () => {
    const deals = [
      { id: 'd1', date: '2020-01-01', status: 'Completed', dealType: 'Acquisition', ownershipPct: 100 },
      { id: 'd2', date: '2022-01-01', status: 'Completed', dealType: 'Partial Stake Sale', ownershipPct: 50 },
    ]
    const parts = [
      { dealId: 'd1', partyType: 'firm', partyId: 'firm-a', role: 'buyer', pct: 1, fundIds: [] },
      { dealId: 'd1', partyType: 'asset', partyId: 'asset-x', role: 'target', pct: null, fundIds: [] },
      { dealId: 'd2', partyType: 'firm', partyId: 'firm-b', role: 'buyer', pct: 0.5, fundIds: [] },
      { dealId: 'd2', partyType: 'firm', partyId: 'firm-c', role: 'buyer', pct: 0.5, fundIds: [] },
      { dealId: 'd2', partyType: 'asset', partyId: 'asset-x', role: 'target', pct: null, fundIds: [] },
    ]
    const { stakes, flags } = deriveStakes(deals, parts)
    const a = stakes.find(s => s.ownerId === 'firm-a')
    expect(a.endDate).toBe(null)
    expect(stakes.find(s => s.ownerId === 'firm-b').pct).toBe(25)
    expect(stakes.find(s => s.ownerId === 'firm-c').pct).toBe(25)
    expect(flags.some(f => f.includes('partial deal'))).toBe(true)
  })
})

describe('deriveStakes — determinism', () => {
  it('assigns identical stake ids regardless of input deal order', () => {
    const deals = [
      { id: 'd-b', date: '2021-01-01', status: 'Completed', dealType: 'Acquisition', ownershipPct: 100 },
      { id: 'd-a', date: '2021-01-01', status: 'Completed', dealType: 'Acquisition', ownershipPct: 100 },
    ]
    const parts = [
      { dealId: 'd-a', partyType: 'firm', partyId: 'firm-a', role: 'buyer', pct: 1, fundIds: [] },
      { dealId: 'd-a', partyType: 'asset', partyId: 'asset-1', role: 'target', pct: null, fundIds: [] },
      { dealId: 'd-b', partyType: 'firm', partyId: 'firm-b', role: 'buyer', pct: 1, fundIds: [] },
      { dealId: 'd-b', partyType: 'asset', partyId: 'asset-2', role: 'target', pct: null, fundIds: [] },
    ]
    const r1 = deriveStakes(deals, parts).stakes
    const r2 = deriveStakes([...deals].reverse(), parts).stakes
    expect(r1.map(s => `${s.id}:${s.ownerId}`)).toEqual(r2.map(s => `${s.id}:${s.ownerId}`))
  })

  it('flags multi-buyer deals with missing pct instead of silently over-allocating', () => {
    const deals = [{ id: 'd1', date: '2021-01-01', status: 'Completed', dealType: 'Acquisition', ownershipPct: 100 }]
    const parts = [
      { dealId: 'd1', partyType: 'firm', partyId: 'firm-a', role: 'buyer', pct: null, fundIds: [] },
      { dealId: 'd1', partyType: 'firm', partyId: 'firm-b', role: 'buyer', pct: null, fundIds: [] },
      { dealId: 'd1', partyType: 'asset', partyId: 'asset-x', role: 'target', pct: null, fundIds: [] },
    ]
    const { flags } = deriveStakes(deals, parts)
    expect(flags.some(f => f.includes('missing pct'))).toBe(true)
  })
})
