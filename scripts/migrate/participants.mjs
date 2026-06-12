import { slugify, splitCompoundFirm } from './helpers.mjs'
import { upsertFirm, upsertAsset, classifyParty } from './harvest.mjs'

export function buildDealParticipants(deal, reg) {
  const rows = []
  const flags = []
  const push = r => rows.push({ pct: null, fundId: null, ...r, dealId: deal.id })

  // ── Buyers: split compound acquirer, classify each part as firm or asset
  const buyerParts = splitCompoundFirm(deal.acquirer.name)
  const pct = +(1 / buyerParts.length).toFixed(4)
  if (buyerParts.length > 1) {
    flags.push(`${deal.id}: compound buyer "${deal.acquirer.name}" split equally at ${pct} — verify against deal terms`)
  }
  for (const part of buyerParts) {
    const cls = classifyParty(reg, part)
    if (cls.kind === 'firm') {
      if (slugify(part) !== slugify(cls.record.name)) {
        flags.push(`${deal.id}: buyer "${part}" fuzzy-matched to firm "${cls.record.name}" — verify`)
      }
      push({ partyType: 'firm', partyId: cls.record.id, role: 'buyer', pct })
    } else {
      const a = upsertAsset(reg, { name: part, type: deal.acquirer.type,
        ticker: buyerParts.length === 1 ? deal.acquirer.ticker : null })
      push({ partyType: 'asset', partyId: a.id, role: 'buyer', pct })
    }
  }

  // ── Backer: acquirer.pe sponsors the buyer (skip when the buyer IS that firm)
  if (deal.acquirer.pe?.firm) {
    for (const f of upsertFirm(reg, deal.acquirer.pe.firm, deal.acquirer.pe)) {
      if (!rows.some(r => r.partyId === f.id)) {
        push({ partyType: 'firm', partyId: f.id, role: 'backer' })
      }
    }
  }

  // ── Targets: consolidations split into constituent assets
  const isConsolidation = deal.dealType === 'Consolidation'
  const targetParts = isConsolidation
    ? splitCompoundFirm(deal.acquired.name)
    : [deal.acquired.name]
  if (isConsolidation) {
    flags.push(`${deal.id}: consolidation targets split: ${targetParts.join(' | ')} — verify`)
  }
  for (const part of targetParts) {
    const a = upsertAsset(reg, { name: part, type: deal.acquired.type,
      ticker: targetParts.length === 1 ? deal.acquired.ticker : null })
    push({ partyType: 'asset', partyId: a.id, role: 'target' })
  }

  // ── Successor: "(Consolidated into X)" / "(now X)" / "(merged into X)"
  const succ = deal.acquired.name.match(/\((?:consolidated into|now|merged into)\s+([^)]+)\)/i)
  if (isConsolidation && succ) {
    const s = upsertAsset(reg, { name: succ[1].trim(), type: deal.acquired.type, ticker: null })
    push({ partyType: 'asset', partyId: s.id, role: 'successor' })
  } else if (isConsolidation) {
    flags.push(`${deal.id}: consolidation with no successor annotation — set successor in overrides.json`)
  }

  // ── Seller: acquired.pe is the selling sponsor; "(from X)" is the fallback signal
  if (deal.acquired.pe?.firm) {
    for (const f of upsertFirm(reg, deal.acquired.pe.firm, deal.acquired.pe)) {
      push({ partyType: 'firm', partyId: f.id, role: 'seller' })
    }
  } else {
    const from = deal.acquired.name.match(/\(from\s+([^)]+)\)/i)
    if (from) {
      const cls = classifyParty(reg, from[1].trim())
      if (cls.kind === 'firm') {
        push({ partyType: 'firm', partyId: cls.record.id, role: 'seller' })
      } else {
        flags.push(`${deal.id}: seller "(from ${from[1].trim()})" not a known firm — review`)
      }
    }
  }

  return { rows, flags }
}
