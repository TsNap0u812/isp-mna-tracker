import { describe, it, expect } from 'vitest'
import { buildPEDirectory } from '../src/components/CompanyInfoPage.jsx'

describe('PE directory data contract', () => {
  const dir = buildPEDirectory()
  it('includes the major sponsors', () => {
    const names = dir.map(f => f.firm)
    expect(names).toContain('TPG Capital')
    expect(names).toContain('Stonepeak Infrastructure Partners')
  })
  it('TPG portfolio has no sold assets, Stonepeak holds Astound', () => {
    const tpg = dir.find(f => f.firm === 'TPG Capital')
    expect(tpg.otherTelecomPortfolio.join('|')).not.toMatch(/astound/i)
    const sp = dir.find(f => f.firm === 'Stonepeak Infrastructure Partners')
    expect(sp.otherTelecomPortfolio.join('|')).toMatch(/astound/i)
  })
  it('every firm card has at least one deal ref', () => {
    expect(dir.every(f => f.dealRefs.length > 0)).toBe(true)
  })
})
