// Apply manual stake corrections from overrides.json ("stakeOverrides").
//
// Runs AFTER deriveStakes, so it can fix residuals the derivation can't infer —
// e.g. a partial deal where the buyer bought FROM an existing owner (reduce the
// seller's stake) or a missing pre-history owner on the selling side.
//
// Entry shapes:
//   { action: "patch", match: { assetId, ownerId, openedByDealId? ... }, set: { pct, endDate, closedByDealId, ... } }
//     — every field present in `match` must equal the stake's value (null matches null,
//       so openedByDealId: null targets pre-history stakes). Exactly one stake must match:
//       zero matches or >1 matches flag and apply nothing.
//   { action: "add", stake: { assetId, ownerType, ownerId, pct, startDate, endDate, openedByDealId, closedByDealId } }
//     — appends a stake with the next sequential stake-NNN id.
//
// All referenced assetId / ownerId / deal ids must exist; otherwise the entry is
// flagged and skipped. Mutates `stakes` in place; returns { flags }.

export function applyStakeOverrides(stakes, stakeOverrides, { assetIds, firmIds, dealIds }) {
  const flags = []
  let nextN = stakes.reduce((m, s) => {
    const n = Number((s.id ?? '').replace('stake-', ''))
    return Number.isFinite(n) ? Math.max(m, n) : m
  }, 0)

  const knownOwner = id => firmIds.has(id) || assetIds.has(id)
  const badIds = (label, fields) => {
    const bad = []
    if ('assetId' in fields && fields.assetId != null && !assetIds.has(fields.assetId)) bad.push(`assetId ${fields.assetId}`)
    if ('ownerId' in fields && fields.ownerId != null && !knownOwner(fields.ownerId)) bad.push(`ownerId ${fields.ownerId}`)
    for (const k of ['openedByDealId', 'closedByDealId']) {
      if (k in fields && fields[k] != null && !dealIds.has(fields[k])) bad.push(`${k} ${fields[k]}`)
    }
    if (bad.length) flags.push(`stake override ${label}: unknown ${bad.join(', ')}, skipped`)
    return bad.length > 0
  }

  for (const o of stakeOverrides ?? []) {
    if (o.action === 'patch') {
      const label = `patch ${JSON.stringify(o.match)}`
      if (badIds(label, { ...o.match, ...o.set })) continue
      const hits = stakes.filter(s => Object.entries(o.match).every(([k, v]) => s[k] === v))
      if (hits.length === 0) { flags.push(`stake override ${label}: matched nothing`); continue }
      if (hits.length > 1) { flags.push(`stake override ${label}: ambiguous — matched ${hits.length} stakes (${hits.map(s => s.id).join(', ')}), applied to none`); continue }
      Object.assign(hits[0], o.set)
    } else if (o.action === 'add') {
      const label = `add ${o.stake?.assetId} ← ${o.stake?.ownerId}`
      if (badIds(label, o.stake)) continue
      stakes.push({
        id: `stake-${String(++nextN).padStart(3, '0')}`,
        endDate: null, closedByDealId: null, ...o.stake,
      })
    } else {
      flags.push(`stake override: unknown action "${o.action}", skipped`)
    }
  }

  return { flags }
}
