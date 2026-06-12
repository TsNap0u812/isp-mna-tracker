import { describe, it, expect } from 'vitest'
import deals from '../src/data/deals.json'

describe('legacy data sanity', () => {
  it('loads the legacy deals file', () => {
    expect(deals.length).toBeGreaterThanOrEqual(50)
    expect(deals[0]).toHaveProperty('id')
    expect(deals[0]).toHaveProperty('acquirer.name')
  })
})
