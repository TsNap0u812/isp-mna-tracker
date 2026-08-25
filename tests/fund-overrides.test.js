// tests/fund-overrides.test.js
//
// applyFundOverrides(firms, overrides) — pure merge of scripts/fund-overrides.json
// into the firm entries assembled by scripts/fund-data-query.mjs.
//
// Semantics under test:
//   • every firm gains capitalType (default "fund" when not overridden)
//   • capitalNote / announcedFunds copied through when provided
//   • unknown firmRaw keys in overrides → console.warn (never throws)
//   • input arrays/objects are not mutated

import { describe, it, expect, vi, afterEach } from 'vitest'
import { applyFundOverrides } from '../scripts/fund-data-query.mjs'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const makeFirms = () => [
  { firmRaw: 'Alpha Capital', firmKey: 'alpha-capital', dealCount: 2 },
  { firmRaw: 'Beta Holdings (Family)', firmKey: 'beta-holdings-family', dealCount: 1 },
]

afterEach(() => vi.restoreAllMocks())

describe('applyFundOverrides', () => {
  it('defaults capitalType to "fund" for firms without an override', () => {
    const out = applyFundOverrides(makeFirms(), { firms: {} })
    expect(out).toHaveLength(2)
    out.forEach(f => expect(f.capitalType).toBe('fund'))
  })

  it('handles missing/empty overrides objects', () => {
    expect(applyFundOverrides(makeFirms(), {})).toHaveLength(2)
    expect(applyFundOverrides(makeFirms(), null)[0].capitalType).toBe('fund')
    expect(applyFundOverrides(makeFirms(), undefined)[1].capitalType).toBe('fund')
  })

  it('applies capitalType and capitalNote from a matching override', () => {
    const overrides = {
      firms: {
        'Beta Holdings (Family)': {
          capitalType: 'balance-sheet',
          capitalNote: 'Family-owned — balance-sheet acquirer.',
        },
      },
    }
    const out = applyFundOverrides(makeFirms(), overrides)
    const beta = out.find(f => f.firmRaw === 'Beta Holdings (Family)')
    expect(beta.capitalType).toBe('balance-sheet')
    expect(beta.capitalNote).toBe('Family-owned — balance-sheet acquirer.')
    // untouched firm keeps default and gains no note
    const alpha = out.find(f => f.firmRaw === 'Alpha Capital')
    expect(alpha.capitalType).toBe('fund')
    expect(alpha).not.toHaveProperty('capitalNote')
  })

  it('copies announcedFunds through when provided', () => {
    const announced = [{
      fundName: 'Alpha Fund II',
      sizeUSD: 1_000_000_000,
      announcedDate: '2024-01-15',
      sourceUrl: 'https://example.com/close',
      note: 'final close',
    }]
    const out = applyFundOverrides(makeFirms(), {
      firms: { 'Alpha Capital': { announcedFunds: announced } },
    })
    const alpha = out.find(f => f.firmRaw === 'Alpha Capital')
    expect(alpha.announcedFunds).toEqual(announced)
    expect(alpha.capitalType).toBe('fund') // default still applied
    const beta = out.find(f => f.firmRaw === 'Beta Holdings (Family)')
    expect(beta).not.toHaveProperty('announcedFunds')
  })

  it('warns (does not throw) on unknown firmRaw keys, listing them', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const out = applyFundOverrides(makeFirms(), {
      firms: {
        'Alpha Capital': { capitalType: 'evergreen' },
        'Ghost Partners': { capitalType: 'fund' },
        'Phantom LLC': { capitalNote: 'nope' },
      },
    })
    expect(out.find(f => f.firmRaw === 'Alpha Capital').capitalType).toBe('evergreen')
    expect(warn).toHaveBeenCalledTimes(1)
    const msg = warn.mock.calls[0].join(' ')
    expect(msg).toContain('Ghost Partners')
    expect(msg).toContain('Phantom LLC')
  })

  it('does not warn when every key matches', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    applyFundOverrides(makeFirms(), { firms: { 'Alpha Capital': { capitalType: 'fund' } } })
    expect(warn).not.toHaveBeenCalled()
  })

  it('does not mutate the input firms array', () => {
    const firms = makeFirms()
    const snapshot = JSON.parse(JSON.stringify(firms))
    applyFundOverrides(firms, { firms: { 'Alpha Capital': { capitalType: 'evergreen' } } })
    expect(firms).toEqual(snapshot)
  })
})

describe('scripts/fund-overrides.json (seed file)', () => {
  const overrides = JSON.parse(
    readFileSync(join(__dirname, '../scripts/fund-overrides.json'), 'utf8')
  )
  const fundData = JSON.parse(
    readFileSync(join(__dirname, '../src/data/fund-data.json'), 'utf8')
  )
  const knownFirmRaws = new Set(fundData.firms.map(f => f.firmRaw))

  it('every firmRaw key matches a firm in fund-data.json', () => {
    for (const key of Object.keys(overrides.firms)) {
      expect(knownFirmRaws.has(key), `unknown firmRaw: ${key}`).toBe(true)
    }
  })

  it('entries are schema-valid', () => {
    const CAPITAL_TYPES = new Set(['fund', 'evergreen', 'balance-sheet'])
    for (const [key, entry] of Object.entries(overrides.firms)) {
      if (entry.capitalType !== undefined) {
        expect(CAPITAL_TYPES.has(entry.capitalType), `${key}: bad capitalType`).toBe(true)
      }
      for (const af of entry.announcedFunds ?? []) {
        expect(typeof af.fundName, `${key}: fundName`).toBe('string')
        expect(typeof af.sizeUSD, `${key}: sizeUSD`).toBe('number')
        expect(af.sizeUSD).toBeGreaterThan(0)
        expect(af.announcedDate, `${key}: announcedDate`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(af.sourceUrl, `${key}: sourceUrl`).toMatch(/^https?:\/\//)
      }
    }
  })

  it('the four structurally-invisible firms are seeded with non-fund capitalType', () => {
    expect(overrides.firms['Wren House Infrastructure Management']?.capitalType).toBe('evergreen')
    expect(overrides.firms['Cox Enterprises (Private Family Ownership)']?.capitalType).toBe('balance-sheet')
    expect(overrides.firms['Mediacom (Founder-Owned / Private)']?.capitalType).toBe('balance-sheet')
    expect(overrides.firms['Fidelity Investments (Colt Owner)']?.capitalType).toBe('balance-sheet')
  })
})
