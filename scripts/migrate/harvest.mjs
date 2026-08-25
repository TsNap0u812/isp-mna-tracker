import { slugify, baseName, assetKey, splitCompoundFirm, extractFundNum } from './helpers.mjs'

export function createRegistry() {
  return { firms: new Map(), funds: new Map(), assets: new Map(), flags: [] }
}

// Returns an ARRAY of firm records (compound names produce several).
export function upsertFirm(reg, name, pe = null) {
  const parts = splitCompoundFirm(name)
  return parts.map(n => {
    const key = slugify(n)
    if (!reg.firms.has(key)) {
      reg.firms.set(key, {
        id: `firm-${key}`, name: n, aliases: [],
        firmType: null, aum: null, headquarters: null, website: null,
      })
    }
    const f = reg.firms.get(key)
    // parts.length === 1: compound names must not alias-pollute their sibling parts
    if (parts.length === 1 && name !== f.name && !f.aliases.includes(name)) {
      f.aliases.push(name)
    }
    // Enrich only when the pe blob unambiguously describes this single firm
    if (pe && parts.length === 1 && slugify(splitCompoundFirm(pe.firm)[0]) === key) {
      f.firmType ??= pe.firmType ?? null
      f.aum ??= pe.aum ?? null
      f.headquarters ??= pe.headquarters ?? null
      f.website ??= pe.website ?? null
    } else if (pe && parts.length > 1) {
      const flag = `firm enrichment skipped for compound "${name}" — assign firmType/aum manually`
      if (!reg.flags.includes(flag)) reg.flags.push(flag)
    }
    return f
  })
}

export function sponsorFor(fundName, firms, reg = null) {
  const fw = fundName.split(/\s+/)[0].toLowerCase()
  const match = firms.find(f => f.name.toLowerCase().startsWith(fw))
  if (!match && firms.length > 0) {
    if (reg) {
      const flag = `fund "${fundName}": no sponsor name match — defaulted to "${firms[0].name}", verify`
      if (!reg.flags.includes(flag)) reg.flags.push(flag)
    }
    return firms[0]
  }
  return match ?? firms[0]
}

// Shared key derivation: first word of the base name + fund number when one
// exists, else the full slug. upsertFund and resolveFundIds must agree on this.
export function fundKey(fundName) {
  const num = extractFundNum(fundName)
  const fw = baseName(fundName).split(/\s+/)[0].toLowerCase()
  return num != null ? `${fw}-${num}` : slugify(fundName)
}

// Map legacy pe.primaryFunds names to registry fund ids. Names with no
// registry entry (junk that upsertFund skipped, typos) are silently omitted.
export function resolveFundIds(reg, primaryFunds) {
  const ids = []
  for (const name of primaryFunds ?? []) {
    const fund = reg.funds.get(fundKey(name))
    if (fund && !ids.includes(fund.id)) ids.push(fund.id)
  }
  return ids
}

export function upsertFund(reg, fundName, sponsorFirms) {
  // Junk placeholders ("N/A", "N/A — family-owned conglomerate") and names
  // listed in reg.notFunds (lowercase) are not real vehicles — create nothing.
  if (/^n\/?a\b/i.test(fundName.trim()) || reg.notFunds?.has(fundName.trim().toLowerCase())) {
    return null
  }
  const num = extractFundNum(fundName)
  const key = fundKey(fundName)
  if (!reg.funds.has(key)) {
    reg.funds.set(key, { id: `fund-${key}`, name: fundName, number: num, sponsorFirmIds: [] })
  }
  const fund = reg.funds.get(key)
  if (fundName !== fund.name) {
    const flag = `fund "${fundName}" merged into "${fund.name}" (key ${key}) — verify same vehicle`
    if (!reg.flags.includes(flag)) reg.flags.push(flag)
  }
  for (const firm of sponsorFirms) {
    if (firm && !fund.sponsorFirmIds.includes(firm.id)) fund.sponsorFirmIds.push(firm.id)
  }
  return fund
}

export function upsertAsset(reg, party) {
  const key = assetKey(party.name)
  if (!reg.assets.has(key)) {
    reg.assets.set(key, {
      id: `asset-${key}`, name: baseName(party.name), aliases: [],
      type: party.type ?? null, ticker: party.ticker ?? null,
      parentAssetId: null, successorAssetId: null,
    })
  }
  const a = reg.assets.get(key)
  if (party.name !== a.name && !a.aliases.includes(party.name)) a.aliases.push(party.name)
  a.type ??= party.type ?? null
  a.ticker ??= party.ticker ?? null
  return a
}

// A party name is a firm if a registered firm shares its first word.
// Run AFTER pass-1 harvesting so reg.firms is fully populated.
export function classifyParty(reg, name) {
  const base = baseName(name).toLowerCase()
  if (reg.notFirms?.has(base)) return { kind: 'asset', record: null }
  const fw = base.split(/\s+/)[0]
  for (const f of reg.firms.values()) {
    if (f.name.split(/\s+/)[0].toLowerCase() === fw) return { kind: 'firm', record: f }
  }
  return { kind: 'asset', record: null }
}
