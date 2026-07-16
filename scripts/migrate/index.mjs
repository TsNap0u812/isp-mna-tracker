// scripts/migrate/index.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRegistry, upsertFirm, upsertFund, sponsorFor } from './harvest.mjs'
import { buildDealParticipants } from './participants.mjs'
import { deriveStakes } from './stakes.mjs'
import { applyStakeOverrides } from './stake-overrides.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const legacy = JSON.parse(readFileSync(join(ROOT, 'src/data/deals.json'), 'utf8'))
const overrides = JSON.parse(readFileSync(join(ROOT, 'scripts/migrate/overrides.json'), 'utf8'))

const reg = createRegistry()
// notFirms matches against baseName(name).toLowerCase() — parenthetical annotations are stripped before comparison
reg.notFirms = new Set((overrides.notFirms ?? []).map(n => n.toLowerCase()))
// notFunds matches the raw legacy primaryFunds string, lowercased (junk placeholders)
reg.notFunds = new Set((overrides.notFunds ?? []).map(n => n.toLowerCase()))

// ── Pass 1: harvest all firms + funds from every pe blob ─────────────────────
for (const d of legacy) {
  for (const party of [d.acquirer, d.acquired]) {
    if (!party?.pe?.firm) continue
    const firms = upsertFirm(reg, party.pe.firm, party.pe)
    for (const fundName of party.pe.primaryFunds ?? []) {
      upsertFund(reg, fundName, [sponsorFor(fundName, firms, reg)])
    }
  }
}

// ── Pass 2: participants + normalized deal records ───────────────────────────
const participants = []
const flagSet = new Set(reg.flags)
const buyerOverrides = overrides.buyerOverrides ?? {}
const deals = legacy.map(d => {
  const { rows, flags } = buildDealParticipants(d, reg, buyerOverrides)
  participants.push(...rows)
  flags.forEach(f => flagSet.add(f))
  return {
    id: d.id, date: d.date, status: d.status, dealType: d.dealType,
    valueUSD: d.dealValue ?? null, ownershipPct: d.ownershipPct ?? null,
    geography: d.geography ?? [], subscribers: d.subscribers ?? null,
    reason: d.reason ?? '', strategicImportance: d.strategicImportance ?? '',
    keyTerms: d.keyTerms ?? '', notes: d.notes ?? '',
    display: {
      acquirerName: d.acquirer.name, acquirerType: d.acquirer.type ?? null,
      acquirerTicker: d.acquirer.ticker ?? null,
      acquiredName: d.acquired.name, acquiredType: d.acquired.type ?? null,
      acquiredTicker: d.acquired.ticker ?? null,
    },
  }
})
reg.flags.forEach(f => flagSet.add(f))   // pick up flags added during pass 2 upserts

// ── Deal patches: shallow field corrections on normalized deal records ───────
// Applied before pass 5 so deriveStakes sees the corrected values.
for (const [dealId, patch] of Object.entries(overrides.dealPatches ?? {})) {
  const deal = deals.find(d => d.id === dealId)
  if (!deal) { flagSet.add(`deal patch ${dealId}: unknown deal id, skipped`); continue }
  Object.assign(deal, patch)
}

// ── Integrity check: buyer override partyIds must reference known entities ───
for (const [dealId, entries] of Object.entries(buyerOverrides)) {
  for (const { partyType, partyId } of entries) {
    const key = partyId.replace(/^(asset-|firm-)/, '')
    const known = partyType === 'asset' ? reg.assets.has(key) : reg.firms.has(key)
    if (!known) flagSet.add(`buyer override ${partyId} on ${dealId}: unknown entity`)
  }
}

// ── Pass 3: apply merges (assets AND firms) ──────────────────────────────────
function applyMerge(idPrefix, registryMap, mergeSpec) {
  const toSet = new Set(Object.values(mergeSpec ?? {}))
  for (const fromId of Object.keys(mergeSpec ?? {})) {
    if (toSet.has(fromId)) flagSet.add(`override merge: "${fromId}" is both a source and a target — chain detected, verify order`)
  }
  for (const [fromId, toId] of Object.entries(mergeSpec ?? {})) {
    const fromKey = fromId.replace(idPrefix, '')
    const toKey = toId.replace(idPrefix, '')
    const from = registryMap.get(fromKey)
    const to = registryMap.get(toKey)
    if (!from || !to) { flagSet.add(`override merge ${fromId} → ${toId}: id not found, skipped`); continue }
    for (const alias of [from.name, ...from.aliases]) {
      if (alias !== to.name && !to.aliases.includes(alias)) to.aliases.push(alias)
    }
    // prefer 'to' values; backfill nulls from 'from'
    for (const k of Object.keys(from)) {
      if (k !== 'id' && k !== 'name' && k !== 'aliases' && to[k] == null && from[k] != null) to[k] = from[k]
    }
    registryMap.delete(fromKey)
    for (const p of participants) if (p.partyId === fromId) p.partyId = toId
  }
}
applyMerge('asset-', reg.assets, overrides.assetMerges)
applyMerge('firm-', reg.firms, overrides.firmMerges)
// firm merges also affect fund sponsors
for (const fund of reg.funds.values()) {
  fund.sponsorFirmIds = [...new Set(fund.sponsorFirmIds.map(id => overrides.firmMerges?.[id] ?? id))]
}

// Merges can leave a backer row duplicating a buyer on the same deal
// (participants.mjs guards this pre-merge) — drop the redundant backer.
for (let i = participants.length - 1; i >= 0; i--) {
  const p = participants[i]
  if (p.role === 'backer' && participants.some(q =>
      q.dealId === p.dealId && q.partyId === p.partyId && q.role === 'buyer')) {
    participants.splice(i, 1)
  }
}

// ── Firm patches: manual enrichment (applied AFTER merges, sets only given fields)
for (const [firmId, patch] of Object.entries(overrides.firmPatches ?? {})) {
  const firm = reg.firms.get(firmId.replace('firm-', ''))
  if (!firm) { flagSet.add(`firm patch ${firmId}: unknown firm id, skipped`); continue }
  Object.assign(firm, patch)
}

for (const [childId, parentId] of Object.entries(overrides.parentAssets ?? {})) {
  const child = reg.assets.get(childId.replace('asset-', ''))
  if (child) child.parentAssetId = parentId
  else flagSet.add(`override parent ${childId}: id not found, skipped`)
}

// ── Pass 4: lineage — successor participants set successorAssetId ────────────
for (const d of deals) {
  const ps = participants.filter(p => p.dealId === d.id)
  const succ = ps.find(p => p.role === 'successor')
  if (!succ) continue
  for (const t of ps.filter(p => p.role === 'target')) {
    const a = reg.assets.get(t.partyId.replace('asset-', ''))
    if (a && a.id !== succ.partyId) a.successorAssetId = succ.partyId
  }
}

// ── Pass 5: stakes ───────────────────────────────────────────────────────────
const { stakes, flags: stakeFlags } = deriveStakes(deals, participants)
stakeFlags.forEach(f => flagSet.add(f))

// ── Stake overrides: manual corrections for residuals deriveStakes can't infer ─
const { flags: stakeOverrideFlags } = applyStakeOverrides(stakes, overrides.stakeOverrides, {
  assetIds: new Set([...reg.assets.values()].map(a => a.id)),
  firmIds: new Set([...reg.firms.values()].map(f => f.id)),
  dealIds: new Set(deals.map(d => d.id)),
})
stakeOverrideFlags.forEach(f => flagSet.add(f))

// ── Write output ─────────────────────────────────────────────────────────────
const outDir = join(ROOT, 'src/data/db')
mkdirSync(outDir, { recursive: true })
const sortById = arr => [...arr].sort((a, b) => (a.id ?? '').localeCompare(b.id ?? ''))
const write = (name, data) =>
  writeFileSync(join(outDir, name), JSON.stringify(data, null, 2) + '\n')

write('firms.json', sortById([...reg.firms.values()]))
write('funds.json', sortById([...reg.funds.values()]))
write('assets.json', sortById([...reg.assets.values()]))
write('deals.json', deals)
write('participants.json', participants)
write('stakes.json', stakes)

const allFlags = [...flagSet]
const report = [
  '# Migration report', '',
  `Generated from src/data/deals.json (${legacy.length} deals).`, '',
  `| Collection | Count |`, `|---|---|`,
  `| firms | ${reg.firms.size} |`, `| funds | ${reg.funds.size} |`,
  `| assets | ${reg.assets.size} |`, `| deals | ${deals.length} |`, `| participants | ${participants.length} |`,
  `| stakes | ${stakes.length} |`, '',
  `## Flags for review (${allFlags.length})`, '',
  ...allFlags.map(f => `- [ ] ${f}`), '',
].join('\n')

mkdirSync(join(ROOT, 'docs'), { recursive: true })
writeFileSync(join(ROOT, 'docs/migration-report.md'), report)

console.log(`Wrote src/data/db/ — firms:${reg.firms.size} funds:${reg.funds.size} assets:${reg.assets.size} participants:${participants.length} stakes:${stakes.length}`)
console.log(`${allFlags.length} flags → docs/migration-report.md`)
