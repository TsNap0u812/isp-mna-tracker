import { describe, it, expect } from 'vitest'
import { injectNewAssets, applyTargetOverrides, validateParentAssets } from '../scripts/migrate/target-overrides.mjs'

const makeReg = () => ({
  assets: new Map([
    ['parent-co', { id: 'asset-parent-co', name: 'Parent Co', aliases: [],
      type: 'ILEC / Fiber', ticker: 'PRNT', parentAssetId: null, successorAssetId: null }],
    ['other-co', { id: 'asset-other-co', name: 'Other Co', aliases: [],
      type: null, ticker: null, parentAssetId: null, successorAssetId: null }],
  ]),
})

describe('injectNewAssets', () => {
  it('injects assets with aliases and successorAssetId defaults', () => {
    const reg = makeReg()
    const { flags } = injectNewAssets(reg, [
      { id: 'asset-parent-co-east', name: 'Parent Co — East Systems',
        type: 'ILEC / Fiber', ticker: null, parentAssetId: 'asset-parent-co' },
    ])
    expect(flags).toEqual([])
    const a = reg.assets.get('parent-co-east')
    expect(a).toEqual({
      id: 'asset-parent-co-east', name: 'Parent Co — East Systems', aliases: [],
      type: 'ILEC / Fiber', ticker: null,
      parentAssetId: 'asset-parent-co', successorAssetId: null,
    })
  })

  it('flags and skips a duplicate id against a harvested asset', () => {
    const reg = makeReg()
    const { flags } = injectNewAssets(reg, [
      { id: 'asset-parent-co', name: 'Impostor', type: null, ticker: null, parentAssetId: null },
    ])
    expect(flags.some(f => f.includes('asset-parent-co') && f.includes('duplicate'))).toBe(true)
    expect(reg.assets.get('parent-co').name).toBe('Parent Co')
  })

  it('handles an absent newAssets section', () => {
    const reg = makeReg()
    expect(injectNewAssets(reg, undefined).flags).toEqual([])
    expect(reg.assets.size).toBe(2)
  })
})

describe('applyTargetOverrides', () => {
  const makeParticipants = () => [
    { pct: 1, fundIds: [], partyType: 'asset', partyId: 'asset-buyer', role: 'buyer', dealId: 'deal-001' },
    { pct: null, fundIds: [], partyType: 'asset', partyId: 'asset-parent-co', role: 'target', dealId: 'deal-001' },
    { pct: null, fundIds: [], partyType: 'firm', partyId: 'firm-seller', role: 'seller', dealId: 'deal-001' },
    { pct: null, fundIds: [], partyType: 'asset', partyId: 'asset-parent-co', role: 'target', dealId: 'deal-002' },
  ]
  const dealIds = new Set(['deal-001', 'deal-002'])

  it('replaces target rows with rows for the listed assets, in place', () => {
    const reg = makeReg()
    injectNewAssets(reg, [
      { id: 'asset-parent-co-east', name: 'East', type: null, ticker: null, parentAssetId: 'asset-parent-co' },
      { id: 'asset-parent-co-west', name: 'West', type: null, ticker: null, parentAssetId: 'asset-parent-co' },
    ])
    const participants = makeParticipants()
    const { flags } = applyTargetOverrides(participants,
      { 'deal-001': ['asset-parent-co-east', 'asset-parent-co-west'] }, reg, dealIds)
    expect(flags).toEqual([])
    const targets = participants.filter(p => p.dealId === 'deal-001' && p.role === 'target')
    expect(targets.map(t => t.partyId)).toEqual(['asset-parent-co-east', 'asset-parent-co-west'])
    expect(targets.every(t => t.partyType === 'asset' && t.pct === null && t.fundIds.length === 0)).toBe(true)
    // buyer and seller rows untouched, replacement sits at the original position
    expect(participants[0].role).toBe('buyer')
    expect(participants[1].partyId).toBe('asset-parent-co-east')
    expect(participants[3].role).toBe('seller')
    // other deals' targets untouched
    expect(participants.filter(p => p.dealId === 'deal-002' && p.role === 'target')[0].partyId)
      .toBe('asset-parent-co')
  })

  it('flags unknown asset ids and keeps the original targets', () => {
    const reg = makeReg()
    const participants = makeParticipants()
    const { flags } = applyTargetOverrides(participants,
      { 'deal-001': ['asset-nope'] }, reg, dealIds)
    expect(flags.some(f => f.includes('deal-001') && f.includes('asset-nope'))).toBe(true)
    expect(participants.filter(p => p.dealId === 'deal-001' && p.role === 'target')[0].partyId)
      .toBe('asset-parent-co')
  })

  it('flags unknown deal ids', () => {
    const reg = makeReg()
    const participants = makeParticipants()
    const { flags } = applyTargetOverrides(participants,
      { 'deal-999': ['asset-parent-co'] }, reg, dealIds)
    expect(flags.some(f => f.includes('deal-999') && f.includes('unknown deal'))).toBe(true)
    expect(participants.length).toBe(4)
  })

  it('handles an absent targetOverrides section', () => {
    const participants = makeParticipants()
    expect(applyTargetOverrides(participants, undefined, makeReg(), dealIds).flags).toEqual([])
    expect(participants.length).toBe(4)
  })
})

describe('validateParentAssets', () => {
  it('flags dangling parentAssetId references', () => {
    const reg = makeReg()
    reg.assets.get('other-co').parentAssetId = 'asset-gone'
    const { flags } = validateParentAssets(reg)
    expect(flags).toEqual(['asset asset-other-co: parentAssetId asset-gone not found — dangling parent'])
  })

  it('passes when every parent exists', () => {
    const reg = makeReg()
    reg.assets.get('other-co').parentAssetId = 'asset-parent-co'
    expect(validateParentAssets(reg).flags).toEqual([])
  })
})
