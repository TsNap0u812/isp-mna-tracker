import { describe, it, expect, beforeEach } from 'vitest'
import { createRegistry, upsertFirm, upsertFund } from '../scripts/migrate/harvest.mjs'
import { buildDealParticipants } from '../scripts/migrate/participants.mjs'

let reg
beforeEach(() => {
  reg = createRegistry()
  // pass-1 firms + funds already harvested
  const [tpg] = upsertFirm(reg, 'TPG Capital', { firm: 'TPG Capital', firmType: 'Private Equity' })
  upsertFund(reg, 'TPG Capital VIII', [tpg])
  upsertFund(reg, 'TPG Capital IX', [tpg])
  upsertFirm(reg, 'Stonepeak Infrastructure Partners',
    { firm: 'Stonepeak Infrastructure Partners', firmType: 'Infrastructure Private Equity' })
  upsertFirm(reg, 'KKR & Co. Inc.', { firm: 'KKR & Co. Inc.', firmType: 'Private Equity' })
})

const DEAL_052 = {
  id: 'deal-052', date: '2021-08-01', status: 'Completed', dealType: 'Acquisition',
  acquirer: { name: 'Stonepeak Infrastructure Partners', type: 'Infrastructure Private Equity', ticker: null, pe: null },
  acquired: { name: 'Astound Broadband (from TPG Capital)', type: 'MSO (Cable) / Fiber', ticker: null,
    pe: { firm: 'TPG Capital', firmType: 'Private Equity',
      primaryFunds: ['TPG Capital VIII', 'TPG Capital IX'] } },
  ownershipPct: 100,
}

it('emits buyer, target and seller rows for a sponsor-to-sponsor sale', () => {
  const { rows } = buildDealParticipants(DEAL_052, reg)
  expect(rows).toContainEqual({ dealId: 'deal-052', partyType: 'firm',
    partyId: 'firm-stonepeak-infrastructure-partners', role: 'buyer', pct: 1, fundIds: [] })
  expect(rows).toContainEqual({ dealId: 'deal-052', partyType: 'asset',
    partyId: 'asset-astound-broadband', role: 'target', pct: null, fundIds: [] })
  expect(rows).toContainEqual({ dealId: 'deal-052', partyType: 'firm',
    partyId: 'firm-tpg-capital', role: 'seller', pct: null,
    fundIds: ['fund-tpg-8', 'fund-tpg-9'] })
})

describe('per-deal fund attribution (fundIds)', () => {
  it('resolves seller fundIds from acquired.pe.primaryFunds; asset rows stay empty', () => {
    const { rows } = buildDealParticipants(DEAL_052, reg)
    const seller = rows.find(r => r.role === 'seller')
    expect(seller.fundIds).toEqual(['fund-tpg-8', 'fund-tpg-9'])
    for (const r of rows.filter(x => x.partyType === 'asset')) {
      expect(r.fundIds).toEqual([])
    }
  })

  it('resolves buyer-firm fundIds from acquirer.pe when the buyer IS the pe firm', () => {
    const d = { id: 'deal-032', date: '2021-04-01', status: 'Completed', dealType: 'Acquisition',
      acquirer: { name: 'TPG Capital (Astound Broadband Formation)', type: 'MSO (Cable) / Fiber', ticker: null,
        pe: { firm: 'TPG Capital', firmType: 'Private Equity',
          primaryFunds: ['TPG Capital VIII', 'TPG Capital IX'] } },
      acquired: { name: 'RCN Telecom', type: 'MSO (Cable)', ticker: null, pe: null },
      ownershipPct: 100 }
    const { rows } = buildDealParticipants(d, reg)
    const buyer = rows.find(r => r.role === 'buyer')
    expect(buyer.partyId).toBe('firm-tpg-capital')
    expect(buyer.fundIds).toEqual(['fund-tpg-8', 'fund-tpg-9'])
    // no duplicate backer row for the same firm
    expect(rows.filter(r => r.partyId === 'firm-tpg-capital')).toHaveLength(1)
  })

  it('resolves backer fundIds when the pe firm sponsors a distinct buyer', () => {
    const d = { id: 'deal-bk', date: '2021-04-01', status: 'Completed', dealType: 'Acquisition',
      acquirer: { name: 'SomePortCo Holdings', type: 'Pure Fiber (FTTH)', ticker: null,
        pe: { firm: 'TPG Capital', firmType: 'Private Equity',
          primaryFunds: ['TPG Capital VIII'] } },
      acquired: { name: 'TinyFiber', type: 'Pure Fiber (FTTH)', ticker: null, pe: null },
      ownershipPct: 100 }
    const { rows } = buildDealParticipants(d, reg)
    const backer = rows.find(r => r.role === 'backer')
    expect(backer.partyId).toBe('firm-tpg-capital')
    expect(backer.fundIds).toEqual(['fund-tpg-8'])
  })

  it('omits primaryFunds names that resolve to no registry fund', () => {
    const d = { ...DEAL_052, id: 'deal-junk',
      acquired: { ...DEAL_052.acquired,
        pe: { firm: 'TPG Capital', firmType: 'Private Equity',
          primaryFunds: ['N/A', 'TPG Capital IX'] } } }
    const { rows } = buildDealParticipants(d, reg)
    expect(rows.find(r => r.role === 'seller').fundIds).toEqual(['fund-tpg-9'])
  })
})

it('splits compound buyers 50/50 with a flag', () => {
  const jv = { id: 'deal-jv', date: '2024-07-01', status: 'Completed', dealType: 'Joint Venture',
    acquirer: { name: 'T-Mobile US + KKR', type: 'Wireless Carrier', ticker: null, pe: null },
    acquired: { name: 'MetroNet', type: 'Pure Fiber (FTTH)', ticker: null, pe: null }, ownershipPct: 100 }
  const { rows, flags } = buildDealParticipants(jv, reg)
  const buyers = rows.filter(r => r.role === 'buyer')
  expect(buyers).toHaveLength(2)
  expect(buyers.map(b => b.pct)).toEqual([0.5, 0.5])
  expect(buyers.find(b => b.partyType === 'firm').partyId).toBe('firm-kkr-and-co-inc')
  expect(buyers.find(b => b.partyType === 'asset').partyId).toBe('asset-t-mobile-us')
  expect(flags.some(f => f.includes('compound buyer'))).toBe(true)
})

it('splits consolidation targets and records the successor', () => {
  const cons = { id: 'deal-032', date: '2021-04-01', status: 'Completed', dealType: 'Consolidation',
    acquirer: { name: 'TPG Capital (Astound Broadband Formation)', type: 'MSO (Cable) / Fiber', ticker: null,
      pe: { firm: 'TPG Capital', firmType: 'Private Equity' } },
    acquired: { name: 'RCN Telecom + WaveDivision + Grande Communications (Consolidated into Astound)',
      type: 'MSO (Cable) / Fiber', ticker: null, pe: null }, ownershipPct: 100 }
  const { rows } = buildDealParticipants(cons, reg)
  const targets = rows.filter(r => r.role === 'target').map(r => r.partyId)
  expect(targets).toEqual(['asset-rcn-telecom', 'asset-wavedivision', 'asset-grande-communications'])
  expect(rows.find(r => r.role === 'successor').partyId).toBe('asset-astound')
  expect(rows.find(r => r.role === 'buyer').partyId).toBe('firm-tpg-capital')
  expect(rows.filter(r => r.partyId === 'firm-tpg-capital')).toHaveLength(1)
})

it('flags an unrecognized "(from X)" seller with no seller row', () => {
  const d = { id: 'deal-x1', date: '2024-01-01', status: 'Completed', dealType: 'Acquisition',
    acquirer: { name: 'EchoStar Corporation', type: 'DBS', ticker: 'SATS', pe: null },
    acquired: { name: 'Boost Mobile (from T-Mobile post-Sprint merger)', type: 'MVNO (Prepaid)', ticker: null, pe: null },
    ownershipPct: 100 }
  const { rows, flags } = buildDealParticipants(d, reg)
  expect(rows.some(r => r.role === 'seller')).toBe(false)
  expect(flags.some(f => f.includes('not a known firm'))).toBe(true)
})

it('flags a consolidation without successor annotation', () => {
  const d = { id: 'deal-x2', date: '2024-01-01', status: 'Completed', dealType: 'Consolidation',
    acquirer: { name: 'TPG Capital', type: 'Private Equity', ticker: null, pe: null },
    acquired: { name: 'Alpha Cable + Beta Fiber', type: 'MSO (Cable)', ticker: null, pe: null },
    ownershipPct: 100 }
  const { rows, flags } = buildDealParticipants(d, reg)
  expect(rows.some(r => r.role === 'successor')).toBe(false)
  expect(flags.some(f => f.includes('no successor annotation'))).toBe(true)
})

it('flags when "(from X)" conflicts with acquired.pe.firm', () => {
  const d = { id: 'deal-x3', date: '2024-01-01', status: 'Completed', dealType: 'Acquisition',
    acquirer: { name: 'Stonepeak Infrastructure Partners', type: 'Infrastructure Private Equity', ticker: null, pe: null },
    acquired: { name: 'SomeISP (from Apollo Global)', type: 'MSO (Cable)', ticker: null,
      pe: { firm: 'TPG Capital', firmType: 'Private Equity' } },
    ownershipPct: 100 }
  const { flags } = buildDealParticipants(d, reg)
  expect(flags.some(f => f.includes('conflicts with pe.firm'))).toBe(true)
})

it('applies buyer overrides verbatim, replacing parsed buyers', () => {
  const d = { id: 'deal-bo', date: '2023-01-01', status: 'Completed', dealType: 'Joint Venture',
    acquirer: { name: 'GigaPower LLC (AT&T + BlackRock JV)', type: 'Pure Fiber (FTTH)', ticker: null, pe: null },
    acquired: { name: 'SomeFiber', type: 'Pure Fiber (FTTH)', ticker: null, pe: null },
    ownershipPct: 100 }
  const overrides = { 'deal-bo': [
    { partyType: 'asset', partyId: 'asset-at-and-t-inc', pct: 0.5 },
    { partyType: 'firm', partyId: 'firm-blackrock-infrastructure', pct: 0.5 },
  ] }
  const { rows } = buildDealParticipants(d, reg, overrides)
  const buyers = rows.filter(r => r.role === 'buyer')
  expect(buyers).toHaveLength(2)
  expect(buyers.map(b => b.partyId).sort())
    .toEqual(['asset-at-and-t-inc', 'firm-blackrock-infrastructure'])
  expect(buyers.every(b => b.pct === 0.5)).toBe(true)
})
