import { describe, it, expect } from 'vitest'
import { estDeployedPct, resolveCommitted, resolveDeployment, computeDryPowder }
  from '../src/lib/fund-metrics.js'

const lpRow = (over = {}) => ({
  source: 'CalSTRS', fundName: 'Example Fund IV', vintage: 2021,
  committedM: 200, calledM: 150, asOf: '2025-06-30',
  sourceUrl: 'https://example.com', ...over,
})

describe('resolveCommitted precedence', () => {
  it('picks max lpDisclosures committedM over every other source', () => {
    const r = resolveCommitted({
      lpRows: [lpRow({ committedM: 100 }), lpRow({ committedM: 350, source: 'WSIB', asOf: '2025-03-31' })],
      calpersRow: { committed: 900e6 },
      formDRow: { totalAmountSold: 5e9 },
      announcedFund: { sizeUSD: 14e9 },
    })
    expect(r.committedM).toBe(350)
    expect(r.committedSource).toBe('LP disclosure')
    expect(r.sourceLabel).toBe('WSIB as of 2025-03-31')
    expect(r.isAnnounced).toBe(false)
  })

  it('falls back to CalPERS committed (dollars → $M) when no LP rows', () => {
    const r = resolveCommitted({
      lpRows: [],
      calpersRow: { committed: 200000000 },
      formDRow: { totalAmountSold: 5e9 },
    })
    expect(r.committedM).toBe(200)
    expect(r.committedSource).toBe('CalPERS')
    expect(r.isAnnounced).toBe(false)
  })

  it('falls back to Form D totalAmountSold (dollars → $M)', () => {
    const r = resolveCommitted({ formDRow: { totalAmountSold: 2.5e9 } })
    expect(r.committedM).toBe(2500)
    expect(r.committedSource).toBe('Form D')
    expect(r.isAnnounced).toBe(false)
  })

  it('falls back to announcedFunds sizeUSD with isAnnounced flag', () => {
    const r = resolveCommitted({ announcedFund: { sizeUSD: 14e9 } })
    expect(r.committedM).toBe(14000)
    expect(r.committedSource).toBe('Announced')
    expect(r.isAnnounced).toBe(true)
  })

  it('ignores LP rows without committedM and CalPERS rows without committed', () => {
    const r = resolveCommitted({
      lpRows: [lpRow({ committedM: null })],
      calpersRow: { called: 50e6 },           // scrape row lacking committed
      formDRow: { totalAmountSold: 1e9 },
    })
    expect(r.committedM).toBe(1000)
    expect(r.committedSource).toBe('Form D')
  })

  it('returns nulls when nothing is available', () => {
    const r = resolveCommitted({})
    expect(r).toEqual({ committedM: null, committedSource: null, sourceLabel: null, isAnnounced: false })
  })
})

describe('resolveDeployment', () => {
  it('uses max calledM across LP rows — actual, pct = called/committed', () => {
    const r = resolveDeployment({
      lpRows: [lpRow({ calledM: 42.6 }), lpRow({ calledM: 205.1 })],
      committedM: 200, vintage: 2019,
    })
    expect(r.deployedM).toBeCloseTo(205.1)
    expect(r.deployedPct).toBeCloseTo(205.1 / 200)
    expect(r.isActual).toBe(true)
  })

  it('includes CalPERS called (dollars → $M) among candidates', () => {
    const r = resolveDeployment({
      lpRows: [lpRow({ calledM: 40 })],
      calpersRow: { called: 57923271 },
      committedM: 100, vintage: 2023,
    })
    expect(r.deployedM).toBeCloseTo(57.923271)
    expect(r.isActual).toBe(true)
  })

  it('falls back to the vintage age curve when no called capital exists', () => {
    const r = resolveDeployment({ lpRows: [], committedM: 1000, vintage: 2020 })
    expect(r.isActual).toBe(false)
    expect(r.deployedPct).toBe(estDeployedPct(2020))
    expect(r.deployedM).toBeCloseTo(1000 * estDeployedPct(2020))
  })

  it('actual called with no committed → deployedM set, pct null, still actual', () => {
    const r = resolveDeployment({ lpRows: [lpRow({ calledM: 80 })], committedM: null })
    expect(r.deployedM).toBe(80)
    expect(r.deployedPct).toBeNull()
    expect(r.isActual).toBe(true)
  })

  it('missing everything → nulls, not actual', () => {
    const r = resolveDeployment({})
    expect(r).toEqual({ deployedM: null, deployedPct: null, isActual: false })
  })
})

describe('estDeployedPct (moved, behavior identical)', () => {
  it('matches the original age-curve buckets', () => {
    expect(estDeployedPct(null)).toBeNull()
    expect(estDeployedPct(2019)).toBe(0.94)  // age 7
    expect(estDeployedPct(2020)).toBe(0.88)  // age 6
    expect(estDeployedPct(2021)).toBe(0.80)  // age 5
    expect(estDeployedPct(2022)).toBe(0.70)  // age 4
    expect(estDeployedPct(2023)).toBe(0.56)  // age 3
    expect(estDeployedPct(2024)).toBe(0.38)  // age 2
    expect(estDeployedPct(2025)).toBe(0.20)  // age 1
    expect(estDeployedPct(2026)).toBe(0.08)  // age 0
  })
})

describe('computeDryPowder', () => {
  it('committed − deployed − 10% reserves', () => {
    const r = computeDryPowder({ committedM: 1000, deployedM: 700 })
    expect(r.reservesM).toBe(100)
    expect(r.dryPowderM).toBe(200)
  })

  it('floors at 0 when fully called (called > committed − reserves)', () => {
    const r = computeDryPowder({ committedM: 200, deployedM: 205.1 })
    expect(r.dryPowderM).toBe(0)
  })

  it('nulls without committed; null dry powder without deployed', () => {
    expect(computeDryPowder({ committedM: null, deployedM: 50 }))
      .toEqual({ reservesM: null, dryPowderM: null })
    expect(computeDryPowder({ committedM: 100, deployedM: null }))
      .toEqual({ reservesM: 10, dryPowderM: null })
  })
})
