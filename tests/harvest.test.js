import { describe, it, expect } from 'vitest'
import { createRegistry, upsertFirm, upsertFund, upsertAsset, classifyParty, sponsorFor }
  from '../scripts/migrate/harvest.mjs'

const TPG_PE = { firm: 'TPG Capital', firmType: 'Private Equity', aum: '$185B+',
  primaryFunds: ['TPG Capital VIII'], headquarters: 'Fort Worth, TX', website: 'tpg.com' }

describe('upsertFirm', () => {
  it('creates one record per firm and enriches from pe blob', () => {
    const reg = createRegistry()
    const [f] = upsertFirm(reg, 'TPG Capital', TPG_PE)
    expect(f.id).toBe('firm-tpg-capital')
    expect(f.aum).toBe('$185B+')
    expect(reg.firms.size).toBe(1)
  })
  it('splits compound names into separate firms', () => {
    const reg = createRegistry()
    const firms = upsertFirm(reg, 'Oak Hill Capital + Pamlico Capital', null)
    expect(firms.map(f => f.id))
      .toEqual(['firm-oak-hill-capital', 'firm-pamlico-capital'])
  })
  it('is idempotent — same firm twice yields one record', () => {
    const reg = createRegistry()
    upsertFirm(reg, 'TPG Capital', TPG_PE)
    upsertFirm(reg, 'TPG Capital (Astound Broadband Formation)', null)
    expect(reg.firms.size).toBe(1)
  })
  it('flags a compound firm with pe blob only once', () => {
    const reg = createRegistry()
    const pe = { firm: 'Madison Dearborn Partners + Catania Capital Partners', firmType: 'Private Equity' }
    upsertFirm(reg, 'Madison Dearborn Partners + Catania Capital Partners', pe)
    upsertFirm(reg, 'Madison Dearborn Partners + Catania Capital Partners', pe)
    expect(reg.flags).toHaveLength(1)
  })
})

describe('upsertFund', () => {
  it('dedupes co-led funds by first word + number with multiple sponsors', () => {
    const reg = createRegistry()
    const [crestview] = upsertFirm(reg, 'Crestview Partners', null)
    const [digital] = upsertFirm(reg, 'DigitalBridge Group', null)
    const f1 = upsertFund(reg, 'Crestview Partners IV', [crestview])
    const f2 = upsertFund(reg, 'Crestview Partners IV', [digital, crestview])
    expect(f1).toBe(f2)
    expect(f1.sponsorFirmIds)
      .toEqual(['firm-crestview-partners', 'firm-digitalbridge-group'])
    expect(reg.funds.size).toBe(1)
  })
  it('flags when two different names merge into one fund', () => {
    const reg = createRegistry()
    const [sp] = upsertFirm(reg, 'Stonepeak Infrastructure Partners', null)
    upsertFund(reg, 'Stonepeak Infrastructure Partners IV', [sp])
    upsertFund(reg, 'Stonepeak Infrastructure Fund IV', [sp])
    expect(reg.funds.size).toBe(1)
    expect(reg.flags.some(f => f.includes('Stonepeak Infrastructure Fund IV'))).toBe(true)
  })
  it('skips N/A-style junk fund names, creating nothing', () => {
    const reg = createRegistry()
    const [f] = upsertFirm(reg, 'Cox Enterprises', null)
    expect(upsertFund(reg, 'N/A', [f])).toBe(null)
    expect(upsertFund(reg, 'N/A — family-owned conglomerate', [f])).toBe(null)
    expect(reg.funds.size).toBe(0)
  })
  it('skips fund names listed in reg.notFunds', () => {
    const reg = createRegistry()
    reg.notFunds = new Set(['secured lender consortium'])
    const [f] = upsertFirm(reg, 'E8 Partners', null)
    expect(upsertFund(reg, 'Secured lender consortium', [f])).toBe(null)
    expect(reg.funds.size).toBe(0)
    // names not listed still create funds
    expect(upsertFund(reg, 'E8 Growth Fund', [f])).not.toBe(null)
    expect(reg.funds.size).toBe(1)
  })
  it('keys numberless funds by full slug', () => {
    const reg = createRegistry()
    const [f] = upsertFirm(reg, 'Cox Enterprises', null)
    const fund = upsertFund(reg, 'Cox Family Evergreen Fund', [f])
    expect(fund.id).toBe('fund-cox-family-evergreen-fund')
    expect(fund.number).toBe(null)
  })
})

describe('upsertAsset', () => {
  it('keys by base name and accumulates aliases', () => {
    const reg = createRegistry()
    upsertAsset(reg, { name: 'Astound Broadband', type: 'MSO (Cable) / Fiber', ticker: null })
    const a = upsertAsset(reg, { name: 'Astound Broadband (from TPG Capital)', type: null, ticker: null })
    expect(reg.assets.size).toBe(1)
    expect(a.aliases).toContain('Astound Broadband (from TPG Capital)')
  })
  it('keeps partial-system names distinct from the parent company', () => {
    const reg = createRegistry()
    upsertAsset(reg, { name: 'WideOpenWest (WOW!)', type: 'MSO (Cable)', ticker: 'WOW' })
    upsertAsset(reg, { name: 'WideOpenWest (WOW!) Chicago-Area Cable System', type: 'MSO (Cable)', ticker: null })
    expect(reg.assets.size).toBe(2)
  })
})

describe('classifyParty', () => {
  it('matches a registered firm by first word', () => {
    const reg = createRegistry()
    upsertFirm(reg, 'KKR & Co. Inc.', null)
    expect(classifyParty(reg, 'KKR').kind).toBe('firm')
    expect(classifyParty(reg, 'T-Mobile US').kind).toBe('asset')
  })
  it('never classifies names in reg.notFirms as firms', () => {
    const reg = createRegistry()
    upsertFirm(reg, 'Cox Enterprises', null)
    reg.notFirms = new Set(['cox communications'])
    expect(classifyParty(reg, 'Cox Communications').kind).toBe('asset')
    expect(classifyParty(reg, 'Cox Enterprises').kind).toBe('firm')
  })
})

describe('sponsorFor', () => {
  it('picks the firm whose name starts with the fund first word', () => {
    const reg = createRegistry()
    const firms = upsertFirm(reg, 'Oak Hill Capital + Pamlico Capital', null)
    expect(sponsorFor('Pamlico Capital Fund VI', firms).id).toBe('firm-pamlico-capital')
    expect(sponsorFor('Oak Hill Capital Partners V', firms).id).toBe('firm-oak-hill-capital')
  })
  it('flags the fallback when no firm matches', () => {
    const reg = createRegistry()
    const firms = upsertFirm(reg, 'TPG Capital', null)
    expect(sponsorFor('Berkshire Fund IX', firms, reg).id).toBe('firm-tpg-capital')
    expect(reg.flags.some(f => f.includes('Berkshire Fund IX'))).toBe(true)
  })
})
