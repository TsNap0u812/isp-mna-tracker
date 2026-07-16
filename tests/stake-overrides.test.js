import { describe, it, expect } from 'vitest'
import { applyStakeOverrides } from '../scripts/migrate/stake-overrides.mjs'

const ids = () => ({
  assetIds: new Set(['asset-x', 'asset-y', 'asset-owner']),
  firmIds: new Set(['firm-a', 'firm-b']),
  dealIds: new Set(['deal-001', 'deal-002']),
})

const baseStakes = () => [
  { id: 'stake-001', endDate: null, closedByDealId: null, assetId: 'asset-x',
    ownerType: 'firm', ownerId: 'firm-a', pct: 100, startDate: '2021-01-01', openedByDealId: 'deal-001' },
  { id: 'stake-002', endDate: null, closedByDealId: null, assetId: 'asset-y',
    ownerType: 'firm', ownerId: 'firm-a', pct: 100, startDate: '2021-01-01', openedByDealId: 'deal-001' },
]

describe('applyStakeOverrides — patch', () => {
  it('applies set fields to the single matching stake', () => {
    const stakes = baseStakes()
    const { flags } = applyStakeOverrides(stakes, [
      { action: 'patch',
        match: { assetId: 'asset-x', ownerId: 'firm-a', openedByDealId: 'deal-001' },
        set: { pct: 50, endDate: '2025-04-01', closedByDealId: 'deal-002' } },
    ], ids())
    expect(flags).toEqual([])
    const s = stakes.find(s => s.id === 'stake-001')
    expect(s.pct).toBe(50)
    expect(s.endDate).toBe('2025-04-01')
    expect(s.closedByDealId).toBe('deal-002')
    // the other stake is untouched
    expect(stakes.find(s => s.id === 'stake-002').pct).toBe(100)
  })

  it('matches openedByDealId null against pre-history stakes', () => {
    const stakes = [
      { id: 'stake-001', endDate: null, closedByDealId: null, assetId: 'asset-x',
        ownerType: 'firm', ownerId: 'firm-a', pct: null, startDate: null, openedByDealId: null },
    ]
    const { flags } = applyStakeOverrides(stakes, [
      { action: 'patch',
        match: { assetId: 'asset-x', ownerId: 'firm-a', openedByDealId: null },
        set: { pct: 100 } },
    ], ids())
    expect(flags).toEqual([])
    expect(stakes[0].pct).toBe(100)
  })

  it('flags when the match hits zero stakes', () => {
    const stakes = baseStakes()
    const { flags } = applyStakeOverrides(stakes, [
      { action: 'patch',
        match: { assetId: 'asset-x', ownerId: 'firm-b', openedByDealId: 'deal-001' },
        set: { pct: 50 } },
    ], ids())
    expect(flags.some(f => f.includes('matched nothing'))).toBe(true)
    expect(stakes.every(s => s.pct === 100)).toBe(true)
  })

  it('flags ambiguous matches and applies to none', () => {
    const stakes = baseStakes()
    const { flags } = applyStakeOverrides(stakes, [
      { action: 'patch', match: { ownerId: 'firm-a' }, set: { pct: 50 } },
    ], ids())
    expect(flags.some(f => f.includes('ambiguous'))).toBe(true)
    expect(stakes.every(s => s.pct === 100)).toBe(true)
  })
})

describe('applyStakeOverrides — add', () => {
  it('appends a stake with the next sequential id', () => {
    const stakes = baseStakes()
    const { flags } = applyStakeOverrides(stakes, [
      { action: 'add',
        stake: { assetId: 'asset-x', ownerType: 'asset', ownerId: 'asset-owner', pct: 100,
                 startDate: null, endDate: '2021-01-01', openedByDealId: null, closedByDealId: 'deal-001' } },
      { action: 'add',
        stake: { assetId: 'asset-y', ownerType: 'firm', ownerId: 'firm-b', pct: 50,
                 startDate: '2021-01-01', endDate: null, openedByDealId: 'deal-001', closedByDealId: null } },
    ], ids())
    expect(flags).toEqual([])
    expect(stakes.length).toBe(4)
    expect(stakes[2].id).toBe('stake-003')
    expect(stakes[3].id).toBe('stake-004')
    expect(stakes[2].ownerId).toBe('asset-owner')
    expect(stakes[2].endDate).toBe('2021-01-01')
    expect(stakes[3].endDate).toBe(null)
  })
})

describe('applyStakeOverrides — validation', () => {
  it('flags and skips entries referencing unknown entities', () => {
    const stakes = baseStakes()
    const { flags } = applyStakeOverrides(stakes, [
      { action: 'add',
        stake: { assetId: 'asset-nope', ownerType: 'firm', ownerId: 'firm-a', pct: 100,
                 startDate: null, endDate: null, openedByDealId: null, closedByDealId: null } },
      { action: 'patch',
        match: { assetId: 'asset-x', ownerId: 'firm-a', openedByDealId: 'deal-999' },
        set: { pct: 50 } },
      { action: 'add',
        stake: { assetId: 'asset-x', ownerType: 'firm', ownerId: 'firm-nope', pct: 100,
                 startDate: null, endDate: null, openedByDealId: null, closedByDealId: null } },
    ], ids())
    expect(flags.filter(f => f.includes('unknown')).length).toBe(3)
    expect(stakes.length).toBe(2)
    expect(stakes[0].pct).toBe(100)
  })
})
