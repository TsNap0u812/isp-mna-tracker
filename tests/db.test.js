import { describe, it, expect } from 'vitest'
import { db, portfolioOf, fundsOf, evolutionChain, legacyDeals, participantsOf }
  from '../src/data/db.js'

describe('db indexes', () => {
  it('loads all six collections', () => {
    expect(db.firms.length).toBeGreaterThan(10)
    expect(db.deals.length).toBeGreaterThanOrEqual(50)
    expect(db.stakes.length).toBeGreaterThan(10)
  })
})

describe('generated data correctness', () => {
  it('has no self-owned stakes (assetId === ownerId)', () => {
    expect(db.stakes.filter(s => s.assetId === s.ownerId)).toEqual([])
  })
  it('has no N/A junk funds', () => {
    expect(db.funds.filter(f => /(^|-)n-a(-|$)/.test(f.id))).toEqual([])
  })
  it('Cox and Mediacom share no fund', () => {
    const shared = db.funds.filter(f =>
      f.sponsorFirmIds.includes('firm-cox-enterprises') && f.sponsorFirmIds.includes('firm-mediacom'))
    expect(shared).toEqual([])
  })
  it('GigaPower JV (deal-013) opens 50/50 stakes for AT&T and BlackRock', () => {
    const st = db.stakes.filter(s => s.openedByDealId === 'deal-013')
    expect(st.map(s => `${s.ownerId}:${s.pct}`).sort())
      .toEqual(['asset-at-and-t-inc:50', 'firm-blackrock-infrastructure:50'])
  })
  it('MetroNet JV (deal-041) opens 50/50 stakes for T-Mobile and KKR', () => {
    const st = db.stakes.filter(s => s.openedByDealId === 'deal-041')
    expect(st.map(s => `${s.ownerId}:${s.pct}`).sort())
      .toEqual(['asset-t-mobile-us:50', 'firm-kkr-and-co-inc:50'])
  })
  it('PE firms mistakenly stored as assets are gone', () => {
    expect(db.assets.some(a => a.id === 'asset-digital-colony-partners')).toBe(false)
    expect(db.participants.some(p => p.partyId === 'asset-digital-colony-partners')).toBe(false)
  })
  it('EQT is not a buyer on the Lumos JV (deal-039); only T-Mobile is', () => {
    const buyers = db.participants.filter(p => p.dealId === 'deal-039' && p.role === 'buyer')
    expect(buyers.map(b => b.partyId)).toEqual(['asset-t-mobile-us'])
  })
  it('formerly null-shell firms have a firmType', () => {
    const ids = ['firm-apax-partners', 'firm-ares-management', 'firm-catania-capital-partners',
      'firm-cppib-consortium', 'firm-creditor-consortium', 'firm-digitalbridge-group',
      'firm-elliott-investment-management', 'firm-madison-dearborn-partners',
      'firm-pamlico-capital', 'firm-warburg-pincus']
    for (const id of ids) {
      const f = db.firms.find(x => x.id === id)
      expect(f, id).toBeTruthy()
      expect(f.firmType, id).not.toBe(null)
    }
  })
})

describe('portfolioOf', () => {
  it('TPG no longer holds Astound', () => {
    const names = portfolioOf('firm-tpg-capital').map(a => a.name)
    expect(names.join('|')).not.toMatch(/astound/i)
  })
  it('Stonepeak holds Astound', () => {
    const names = portfolioOf('firm-stonepeak-infrastructure-partners').map(a => a.name)
    expect(names.join('|')).toMatch(/astound/i)
  })
  it('as-of queries see historical ownership', () => {
    const names = portfolioOf('firm-tpg-capital', '2021-06-01').map(a => a.name)
    expect(names.join('|')).toMatch(/astound/i)
  })
  it('dedupes assets held via multiple layered stakes', () => {
    const ids = portfolioOf('firm-tpg-capital').map(a => a.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('asset-directv-llc')
  })
})

describe('legacyDeals', () => {
  it('reconstructs the legacy shape for every deal', () => {
    const all = legacyDeals()
    expect(all.length).toBe(db.deals.length)
    const d = all.find(x => x.id === 'deal-052')
    expect(d.acquirer.name).toBe('Stonepeak Infrastructure Partners')
    expect(d.dealValue).toBe(8100000000)
    expect(d.acquired.pe.firm).toBe('TPG Capital')
    expect(d.acquired.pe.otherTelecomPortfolio.join('|')).not.toMatch(/astound/i)
  })

  it('shows era-correct funds per deal, not every fund the firm ever had', () => {
    const all = legacyDeals()
    const d032 = all.find(x => x.id === 'deal-032')   // TPG 2021
    expect(d032.acquirer.pe.primaryFunds).toContain('TPG Capital VIII')
    expect(d032.acquirer.pe.primaryFunds).not.toContain('TPG Capital X')
    const d022 = all.find(x => x.id === 'deal-022')   // TPG 2024
    expect(d022.acquirer.pe.primaryFunds).toContain('TPG Capital X')
    expect(d022.acquirer.pe.primaryFunds).not.toContain('TPG Capital VIII')
  })

  it('seller pe blocks carry era-correct funds too', () => {
    const d052 = legacyDeals().find(x => x.id === 'deal-052')   // TPG sold Astound in 2021
    expect(d052.acquired.pe.primaryFunds).toContain('TPG Capital VIII')
    expect(d052.acquired.pe.primaryFunds).not.toContain('TPG Capital X')
  })
})

describe('evolutionChain', () => {
  it('walks the Astound lineage back through its predecessors', () => {
    const chain = evolutionChain('asset-astound-broadband')
    expect(chain.length).toBeGreaterThanOrEqual(2)
    expect(chain.some(d => d.dealType === 'Consolidation')).toBe(true)
  })

  it('walks up from a carve-out child to its parent lineage', () => {
    const childChain = evolutionChain('asset-lumen-ilec-20-states').map(d => d.id)
    const parentChain = evolutionChain('asset-lumen-technologies').map(d => d.id)
    expect(childChain.sort()).toEqual(parentChain.sort())
  })
})

describe('participantsOf', () => {
  it('returns buyer, target, seller for deal-052', () => {
    const roles = participantsOf('deal-052').map(p => p.role).sort()
    expect(roles).toContain('buyer')
    expect(roles).toContain('seller')
    expect(roles).toContain('target')
  })
})
