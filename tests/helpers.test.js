import { describe, it, expect } from 'vitest'
import { slugify, baseName, assetKey, splitCompoundFirm, extractFundNum }
  from '../scripts/migrate/helpers.mjs'

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('TPG Capital')).toBe('tpg-capital')
    expect(slugify('KKR & Co. Inc.')).toBe('kkr-and-co-inc')
  })
})

describe('baseName', () => {
  it('strips parenthetical groups but keeps words outside them', () => {
    expect(baseName('Astound Broadband (from TPG Capital)')).toBe('Astound Broadband')
    expect(baseName('WideOpenWest (WOW!) Chicago-Area Cable System'))
      .toBe('WideOpenWest Chicago-Area Cable System')
  })
})

describe('splitCompoundFirm', () => {
  it('splits on slash and plus separators', () => {
    expect(splitCompoundFirm('Oak Hill Capital + Pamlico Capital'))
      .toEqual(['Oak Hill Capital', 'Pamlico Capital'])
    expect(splitCompoundFirm('Apax Partners / Warburg Pincus / CPPIB Consortium'))
      .toEqual(['Apax Partners', 'Warburg Pincus', 'CPPIB Consortium'])
  })
  it('does not split on ampersands and strips parens first', () => {
    expect(splitCompoundFirm('KKR & Co. / Ares Management'))
      .toEqual(['KKR & Co.', 'Ares Management'])
    expect(splitCompoundFirm('EQT Infrastructure / DigitalBridge (co-lead)'))
      .toEqual(['EQT Infrastructure', 'DigitalBridge'])
  })
  it('returns single-element array for simple names', () => {
    expect(splitCompoundFirm('TPG Capital (Astound Broadband Formation)'))
      .toEqual(['TPG Capital'])
  })
})

describe('extractFundNum', () => {
  it('parses trailing roman numerals and digits', () => {
    expect(extractFundNum('TPG Capital VIII')).toBe(8)
    expect(extractFundNum('Crestview Partners IV')).toBe(4)
    expect(extractFundNum('Stonepeak Infrastructure Fund 4')).toBe(4)
  })
  it('returns null when there is no number', () => {
    expect(extractFundNum('Apollo Global Management')).toBe(null)
  })
})
