import { describe, it, expect, beforeEach } from 'vitest'
import { createRegistry, upsertFirm } from '../scripts/migrate/harvest.mjs'
import { buildDealParticipants } from '../scripts/migrate/participants.mjs'

let reg
beforeEach(() => {
  reg = createRegistry()
  // pass-1 firms already harvested
  upsertFirm(reg, 'TPG Capital', { firm: 'TPG Capital', firmType: 'Private Equity' })
  upsertFirm(reg, 'Stonepeak Infrastructure Partners',
    { firm: 'Stonepeak Infrastructure Partners', firmType: 'Infrastructure Private Equity' })
  upsertFirm(reg, 'KKR & Co. Inc.', { firm: 'KKR & Co. Inc.', firmType: 'Private Equity' })
})

const DEAL_052 = {
  id: 'deal-052', date: '2021-08-01', status: 'Completed', dealType: 'Acquisition',
  acquirer: { name: 'Stonepeak Infrastructure Partners', type: 'Infrastructure Private Equity', ticker: null, pe: null },
  acquired: { name: 'Astound Broadband (from TPG Capital)', type: 'MSO (Cable) / Fiber', ticker: null,
    pe: { firm: 'TPG Capital', firmType: 'Private Equity' } },
  ownershipPct: 100,
}

it('emits buyer, target and seller rows for a sponsor-to-sponsor sale', () => {
  const { rows } = buildDealParticipants(DEAL_052, reg)
  expect(rows).toContainEqual({ dealId: 'deal-052', partyType: 'firm',
    partyId: 'firm-stonepeak-infrastructure-partners', role: 'buyer', pct: 1, fundId: null })
  expect(rows).toContainEqual({ dealId: 'deal-052', partyType: 'asset',
    partyId: 'asset-astound-broadband', role: 'target', pct: null, fundId: null })
  expect(rows).toContainEqual({ dealId: 'deal-052', partyType: 'firm',
    partyId: 'firm-tpg-capital', role: 'seller', pct: null, fundId: null })
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
