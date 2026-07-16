import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateInput } from '../scripts/migrate/validate.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const goodDeal = (over = {}) => ({
  id: 'deal-900',
  date: '2026-01-15',
  status: 'Completed',
  dealType: 'Acquisition',
  acquirer: { name: 'Buyer Co' },
  acquired: { name: 'Target Co' },
  ...over,
})

describe('validateInput', () => {
  it('passes a well-formed deal', () => {
    expect(validateInput([goodDeal()]).errors).toEqual([])
  })

  it('flags duplicate ids', () => {
    const { errors } = validateInput([goodDeal(), goodDeal()])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/duplicate id "deal-900"/)
  })

  it('flags missing or empty id', () => {
    expect(validateInput([goodDeal({ id: '' })]).errors[0]).toMatch(/missing or empty "id"/)
    const noId = goodDeal(); delete noId.id
    expect(validateInput([noId]).errors[0]).toMatch(/missing or empty "id"/)
  })

  it('flags missing date and malformed date', () => {
    expect(validateInput([goodDeal({ date: '' })]).errors[0]).toMatch(/missing or empty "date"/)
    expect(validateInput([goodDeal({ date: 'May 19, 2026' })]).errors[0]).toMatch(/date .* not YYYY-MM-DD/)
    expect(validateInput([goodDeal({ date: '2026-5-9' })]).errors[0]).toMatch(/not YYYY-MM-DD/)
  })

  it('flags missing status and unknown status', () => {
    expect(validateInput([goodDeal({ status: '' })]).errors[0]).toMatch(/missing or empty "status"/)
    const { errors } = validateInput([goodDeal({ status: 'Announced' })])
    expect(errors[0]).toMatch(/unknown status "Announced"/)
  })

  it('flags unknown dealType', () => {
    const { errors } = validateInput([goodDeal({ dealType: 'Hostile Takeover' })])
    expect(errors[0]).toMatch(/unknown dealType "Hostile Takeover"/)
  })

  it('flags missing acquirer.name and acquired.name', () => {
    expect(validateInput([goodDeal({ acquirer: {} })]).errors[0]).toMatch(/missing or empty "acquirer.name"/)
    expect(validateInput([goodDeal({ acquired: { name: '' } })]).errors[0]).toMatch(/missing or empty "acquired.name"/)
  })

  it('reports multiple errors across multiple deals', () => {
    const { errors } = validateInput([
      goodDeal({ id: 'deal-901', status: 'Nope' }),
      goodDeal({ id: 'deal-902', dealType: 'Nope' }),
    ])
    expect(errors).toHaveLength(2)
  })

  it('passes the real frozen legacy file cleanly', () => {
    const legacy = JSON.parse(readFileSync(join(ROOT, 'src/data/deals.json'), 'utf8'))
    expect(validateInput(legacy).errors).toEqual([])
  })
})
