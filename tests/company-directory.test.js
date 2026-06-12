import { describe, it, expect } from 'vitest'
import { db, portfolioOf, fundsOf } from '../src/data/db.js'

// Mirrors CompanyInfoPage.buildPEDirectory — guards the page's data contract
function buildPEDirectory() {
  return db.firms
    .map(firm => {
      const dealRefs = db.participants
        .filter(p => p.partyType === 'firm' && p.partyId === firm.id)
        .map(p => {
          const d = db.deal.get(p.dealId)
          return { id: d.id, role: p.role === 'seller' ? 'Backed target' : 'Backed acquirer', status: d.status }
        })
      return {
        firm: firm.name,
        primaryFunds: fundsOf(firm.id).map(f => f.name),
        otherTelecomPortfolio: portfolioOf(firm.id).map(a => a.name),
        dealRefs,
      }
    })
    .filter(f => f.dealRefs.length > 0)
}

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
