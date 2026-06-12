import { describe, it, expect } from 'vitest'
import { buildChain, getSearchSuggestions } from '../src/components/EvolutionsPage.jsx'
import { legacyDeals } from '../src/data/db.js'

const deals = legacyDeals()

describe('buildChain', () => {
  it('astound chain includes consolidation, sale, and predecessor deals', () => {
    const { chain, predecessors } = buildChain('Astound', deals)
    expect(chain.length).toBeGreaterThanOrEqual(3)
    expect(chain.some(d => d.dealType === 'Consolidation')).toBe(true)
    expect(predecessors.join('|')).toMatch(/rcn/i)
  })
  it('newest deal first', () => {
    const { chain } = buildChain('Astound', deals)
    for (let i = 1; i < chain.length; i++) {
      expect(new Date(chain[i-1].date) >= new Date(chain[i].date)).toBe(true)
    }
  })
  it('firm queries return their deal history', () => {
    const { chain } = buildChain('Stonepeak', deals)
    expect(chain.length).toBeGreaterThanOrEqual(2)
  })
  it('no match returns empty chain', () => {
    expect(buildChain('zzz-nonexistent', deals).chain).toEqual([])
  })
})

describe('buildChain — Trace button seeds (raw legacy acquirer names)', () => {
  const seeds = [
    'Astound Broadband (Stonepeak Infrastructure Partners)',
    'Great Plains Communications (GPC)',
    'Socket Fiber (Oak Hill Capital + Pamlico Capital)',
    'Cable One Inc. (Sparklight)',
    'Swyft Fiber (Macquarie Asset Management)',
    'TPG Capital (Astound Broadband Formation)',
  ]
  for (const seed of seeds) {
    it(`resolves "${seed}"`, () => {
      expect(buildChain(seed, deals).chain.length).toBeGreaterThanOrEqual(1)
    })
  }
})

describe('getSearchSuggestions', () => {
  it('suggests entities with deal counts', () => {
    const s = getSearchSuggestions('astound', deals)
    expect(s.length).toBeGreaterThanOrEqual(1)
    expect(s[0].count).toBeGreaterThanOrEqual(1)
  })
  it('caps at 8', () => {
    expect(getSearchSuggestions('a', deals).length).toBeLessThanOrEqual(8)
  })
})
