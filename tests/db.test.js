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
})

describe('evolutionChain', () => {
  it('walks the Astound lineage back through its predecessors', () => {
    const chain = evolutionChain('asset-astound-broadband')
    expect(chain.length).toBeGreaterThanOrEqual(2)
    expect(chain.some(d => d.dealType === 'Consolidation')).toBe(true)
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
