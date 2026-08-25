import { describe, it, expect } from 'vitest'
import { legacyDeals } from '../src/data/db.js'
import { buildLeaderboard } from '../src/components/AnalyticsPage.jsx'
import { buildPEDirectory } from '../src/components/CompanyInfoPage.jsx'
import { buildChain } from '../src/components/EvolutionsPage.jsx'

// Synthetic locally-added deal (Add-deal form shape): id is NOT in the db.
const makeLocal = (over = {}) => ({
  id: 'local-1',
  date: '2026-07-01',
  status: 'Completed',
  dealType: 'Acquisition',
  dealValue: 60e9,
  acquirer: { name: 'Test Acquirer Co', type: 'Pure Fiber (FTTH)', pe: null },
  acquired: { name: 'Test Target Co', type: 'MSO (Cable)', pe: null },
  ...over,
})

describe('locally-added deals overlay', () => {
  it('leaderboard: a $60B local acquirer appears as a row with its value and deal id', () => {
    const rows = buildLeaderboard(legacyDeals().concat([makeLocal()]))
    const row = rows.find(r => r.name === 'Test Acquirer Co')
    expect(row).toBeDefined()
    expect(row.valueB).toBe(60)
    expect(row.count).toBe(1)
    expect(row.dealIds.has('local-1')).toBe(true)
  })

  it('leaderboard: no-arg call still works and ignores terminated local deals', () => {
    const base = buildLeaderboard()
    expect(base.length).toBeGreaterThan(0)
    const rows = buildLeaderboard([makeLocal({ status: 'Terminated' })])
    expect(rows.find(r => r.name === 'Test Acquirer Co')).toBeUndefined()
  })

  it('PE directory: local deal with a known firm adds a dealRef to the existing card', () => {
    const before = buildPEDirectory()
    const tpgBefore = before.find(f => f.firm === 'TPG Capital')
    expect(tpgBefore).toBeDefined()

    const local = makeLocal({
      acquirer: {
        name: 'Test Acquirer Co', type: 'Pure Fiber (FTTH)',
        pe: { firm: 'TPG Capital', firmType: 'Private Equity' },
      },
    })
    const after = buildPEDirectory(legacyDeals().concat([local]))
    const tpgAfter = after.find(f => f.firm === 'TPG Capital')
    expect(tpgAfter.dealRefs.length).toBe(tpgBefore.dealRefs.length + 1)
    const ref = tpgAfter.dealRefs.find(r => r.id === 'local-1')
    expect(ref).toBeDefined()
    expect(ref.role).toBe('Backed acquirer')

    // one new-firm entry must not duplicate existing cards
    expect(after.length).toBe(before.length)
  })

  it('PE directory: local deal with an unknown firm creates a new card', () => {
    const local = makeLocal({
      acquirer: {
        name: 'Test Acquirer Co', type: 'Pure Fiber (FTTH)',
        pe: {
          firm: 'Brand New Capital', firmType: 'Private Equity', aum: '$1B',
          primaryFunds: ['Brand New Fund I'],
        },
      },
    })
    const dir = buildPEDirectory(legacyDeals().concat([local]))
    const card = dir.find(f => f.firm === 'Brand New Capital')
    expect(card).toBeDefined()
    expect(card.dealRefs.length).toBe(1)
    expect(card.dealRefs[0].id).toBe('local-1')
    expect(card.primaryFunds).toEqual(['Brand New Fund I'])
  })

  it('Evolutions: entity-path chain includes a local deal naming the entity', () => {
    const local = makeLocal({
      acquirer: { name: 'Astound Broadband (test expansion)', type: 'MSO (Cable)', pe: null },
      acquired: { name: 'Test Target Co', type: 'Pure Fiber (FTTH)', pe: null },
    })
    const all = legacyDeals().concat([local])
    const { chain } = buildChain('Astound', all)
    expect(chain.map(d => d.id)).toContain('local-1')
    // db-backed Astound deals still present
    expect(chain.length).toBeGreaterThan(1)
    // newest-first ordering preserved after the append
    for (let i = 1; i < chain.length; i++) {
      expect(new Date(chain[i - 1].date) >= new Date(chain[i].date)).toBe(true)
    }
  })
})
