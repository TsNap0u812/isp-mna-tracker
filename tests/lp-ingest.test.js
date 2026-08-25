// tests/lp-ingest.test.js
//
// Generic LP-disclosure CSV ingest (scripts/lp-data/*.csv):
//   ingestLpCsv(csvText)   — pure CSV → row objects (numbers parsed, blanks → null,
//                            quoted fields with embedded commas tolerated)
//   matchLpRows(rows, firms) — assigns rows to firms using the CalPERS-style
//                            fund-name match (firm first-word guard); matched rows
//                            land as firm.lpDisclosures, unmatched → console.warn.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { ingestLpCsv, matchLpRows } from '../scripts/fund-data-query.mjs'

const HEADER = 'source,fundName,vintage,committedM,calledM,distributedM,navM,irr,asOf,sourceUrl'

afterEach(() => vi.restoreAllMocks())

describe('ingestLpCsv', () => {
  it('parses a simple row, converting numeric columns', () => {
    const csv = [
      HEADER,
      'CalSTRS,Stonepeak Infrastructure Fund III,2018,400,380.5,120,310,12.4,2025-09-30,https://example.com/report',
    ].join('\n')
    const rows = ingestLpCsv(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({
      source: 'CalSTRS',
      fundName: 'Stonepeak Infrastructure Fund III',
      vintage: 2018,
      committedM: 400,
      calledM: 380.5,
      distributedM: 120,
      navM: 310,
      irr: 12.4,
      asOf: '2025-09-30',
      sourceUrl: 'https://example.com/report',
    })
  })

  it('turns blank cells into null', () => {
    const csv = [
      HEADER,
      'WSIB,Some Fund IV,,250,,,,,2025-06-30,https://example.com',
    ].join('\n')
    const [row] = ingestLpCsv(csv)
    expect(row.vintage).toBeNull()
    expect(row.calledM).toBeNull()
    expect(row.distributedM).toBeNull()
    expect(row.navM).toBeNull()
    expect(row.irr).toBeNull()
    expect(row.committedM).toBe(250)
  })

  it('tolerates quoted fields containing commas (and quoted quotes)', () => {
    const csv = [
      HEADER,
      'CalSTRS,"Apollo Investment Fund IX, L.P.",2017,"1,000",500,,,"8.1",2025-03-31,https://example.com',
      'CalSTRS,"The ""Big"" Fund, LP",2020,100,,,,,2025-03-31,https://example.com',
    ].join('\n')
    const rows = ingestLpCsv(csv)
    expect(rows[0].fundName).toBe('Apollo Investment Fund IX, L.P.')
    expect(rows[0].committedM).toBe(1000)
    expect(rows[0].irr).toBe(8.1)
    expect(rows[1].fundName).toBe('The "Big" Fund, LP')
  })

  it('skips blank lines and tolerates CRLF line endings', () => {
    const csv = HEADER + '\r\n' +
      'WSIB,Fund A,2019,100,50,10,60,5,2025-06-30,https://example.com\r\n' +
      '\r\n'
    const rows = ingestLpCsv(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].fundName).toBe('Fund A')
  })

  it('returns [] for a header-only template file', () => {
    expect(ingestLpCsv(HEADER + '\n')).toEqual([])
    expect(ingestLpCsv(HEADER)).toEqual([])
  })

  it('throws on a header that does not match the LP-disclosure schema', () => {
    expect(() => ingestLpCsv('foo,bar\n1,2')).toThrow(/header/i)
  })

  it('handles column order matching header positions even with unexpected spacing', () => {
    const csv = 'source, fundName ,vintage,committedM,calledM,distributedM,navM,irr,asOf,sourceUrl\n' +
      'CalSTRS,Fund B,2021,300,,,,,2025-09-30,https://example.com'
    const [row] = ingestLpCsv(csv)
    expect(row.fundName).toBe('Fund B')
  })
})

describe('matchLpRows', () => {
  const makeFirms = () => [
    {
      firmRaw: 'Stonepeak Infrastructure Partners',
      firmNames: ['Stonepeak Infrastructure Partners'],
    },
    {
      firmRaw: 'Apollo Global Management',
      firmNames: ['Apollo Global Management'],
    },
    {
      firmRaw: 'Mediacom (Founder-Owned / Private)',
      firmNames: ['Mediacom (Founder-Owned', 'Private)'],
    },
  ]

  const row = (over = {}) => ({
    source: 'CalSTRS',
    fundName: 'Stonepeak Infrastructure Fund II, LP',
    vintage: 2016,
    committedM: 300,
    calledM: 290,
    distributedM: 200,
    navM: 180,
    irr: 11.2,
    asOf: '2025-09-30',
    sourceUrl: 'https://example.com',
    ...over,
  })

  it('assigns a row to the firm whose first word appears in the fund name', () => {
    const out = matchLpRows([row()], makeFirms())
    const stonepeak = out.find(f => f.firmRaw === 'Stonepeak Infrastructure Partners')
    expect(stonepeak.lpDisclosures).toHaveLength(1)
    expect(stonepeak.lpDisclosures[0].source).toBe('CalSTRS')
    expect(stonepeak.lpDisclosures[0].fundName).toBe('Stonepeak Infrastructure Fund II, LP')
    // other firms untouched
    const apollo = out.find(f => f.firmRaw === 'Apollo Global Management')
    expect(apollo).not.toHaveProperty('lpDisclosures')
  })

  it('matches case-insensitively', () => {
    const out = matchLpRows(
      [row({ fundName: 'APOLLO INVESTMENT FUND IX' })],
      makeFirms()
    )
    const apollo = out.find(f => f.firmRaw === 'Apollo Global Management')
    expect(apollo.lpDisclosures).toHaveLength(1)
  })

  it('warns with a count and fund names for unmatched rows', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const out = matchLpRows(
      [row(), row({ fundName: 'Totally Unrelated Fund VII' }), row({ fundName: 'Another Mystery Fund' })],
      makeFirms()
    )
    expect(out.find(f => f.firmRaw === 'Stonepeak Infrastructure Partners').lpDisclosures).toHaveLength(1)
    expect(warn).toHaveBeenCalledTimes(1)
    const msg = warn.mock.calls[0].join(' ')
    expect(msg).toContain('2')
    expect(msg).toContain('Totally Unrelated Fund VII')
    expect(msg).toContain('Another Mystery Fund')
  })

  it('does not warn when everything matches', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    matchLpRows([row()], makeFirms())
    expect(warn).not.toHaveBeenCalled()
  })

  it('ignores generic split tokens (no accidental match on "Private)")', () => {
    const out = matchLpRows(
      [row({ fundName: 'Private Equity Partners Fund III' })],
      makeFirms()
    )
    const mediacom = out.find(f => f.firmRaw === 'Mediacom (Founder-Owned / Private)')
    expect(mediacom).not.toHaveProperty('lpDisclosures')
  })

  it('accumulates multiple rows per firm and preserves source per row', () => {
    const out = matchLpRows(
      [
        row(),
        row({ source: 'WSIB', fundName: 'Stonepeak Infrastructure Fund IV' }),
      ],
      makeFirms()
    )
    const stonepeak = out.find(f => f.firmRaw === 'Stonepeak Infrastructure Partners')
    expect(stonepeak.lpDisclosures).toHaveLength(2)
    expect(stonepeak.lpDisclosures.map(d => d.source)).toEqual(['CalSTRS', 'WSIB'])
  })

  it('does not mutate the input firms or rows', () => {
    const firms = makeFirms()
    const rows = [row()]
    const firmsSnap = JSON.parse(JSON.stringify(firms))
    const rowsSnap = JSON.parse(JSON.stringify(rows))
    matchLpRows(rows, firms)
    expect(firms).toEqual(firmsSnap)
    expect(rows).toEqual(rowsSnap)
  })

  it('handles empty rows array (all firms pass through unchanged)', () => {
    const out = matchLpRows([], makeFirms())
    expect(out).toHaveLength(3)
    out.forEach(f => expect(f).not.toHaveProperty('lpDisclosures'))
  })
})
