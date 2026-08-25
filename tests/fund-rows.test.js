import { describe, it, expect } from 'vitest'
import deals from '../src/data/deals.json'
import { buildFundRows } from '../src/components/FundMgmtPage.jsx'

const rows = buildFundRows(deals)

describe('buildFundRows — actual called-capital deployment', () => {
  it('TPG fund rows use CalSTRS called capital (isActual, LP disclosure source)', () => {
    const tpg = rows.filter(r => r.firmRaw === 'TPG Capital' && r.isActual)
    expect(tpg.length).toBeGreaterThan(0)
    for (const r of tpg) {
      expect(r.committedSource).toBe('LP disclosure')
      expect(r.deployedM).toBeGreaterThan(0)
      expect(r.deployedPct).toBeCloseTo(r.deployedM / r.committedM)
      expect(r.isEstimated).toBe(false)   // actual path — no age-curve marker
      expect(r.sourceLabel).toMatch(/CalSTRS/)
    }
  })

  it('age-curve rows remain flagged isEstimated and not isActual', () => {
    const est = rows.filter(r => r.isEstimated)
    expect(est.length).toBeGreaterThan(0)
    for (const r of est) {
      expect(r.isActual).toBe(false)
      expect(r.deployedPct).toBeGreaterThan(0)
    }
  })
})

describe('buildFundRows — permanent-capital firms', () => {
  const perm = rows.filter(r => r.permanentCapital)

  it('produces one row per permanent-capital firm (Wren House, Cox, Mediacom, Fidelity)', () => {
    const firms = perm.map(r => r.firmRaw).sort()
    expect(firms).toEqual([
      'Cox Enterprises (Private Family Ownership)',
      'Fidelity Investments (Colt Owner)',
      'Mediacom (Founder-Owned / Private)',
      'Wren House Infrastructure Management',
    ])
    for (const r of perm) {
      expect(['evergreen', 'balance-sheet']).toContain(r.capitalType)
      expect(r.capitalNote).toBeTruthy()
      expect(r.fundName).toBeNull()
      expect(r.committedM).toBeNull()
      expect(r.dryPowderM).toBeNull()
    }
  })

  it('leaves no "N/A" pseudo-fund names anywhere in the row list', () => {
    expect(rows.some(r => r.fundName?.startsWith('N/A'))).toBe(false)
  })

  it('sorts permanent-capital rows to the end of the list', () => {
    const firstPermIdx = rows.findIndex(r => r.permanentCapital)
    expect(firstPermIdx).toBe(rows.length - perm.length)
  })
})
