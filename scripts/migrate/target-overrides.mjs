// Carve-out support: manually authored child assets + target replacement.
//
// Some deals acquire a CARVE-OUT of a company, but their legacy names only
// differ from the parent inside parentheses ("Lumen Technologies (ILEC Assets
// — 20 States)"), which assetKey() strips — so harvesting collapses them into
// the parent asset and stakes derivation invents whole-company transfers.
// overrides.json fixes this with:
//
//   "newAssets": [{ id, name, type, ticker, parentAssetId }]
//     — injected into the registry after pass 2 (before merges). Records get
//       aliases: [] and successorAssetId: null defaults. A duplicate id against
//       a harvested asset flags and skips. parentAssetId is validated later via
//       validateParentAssets (after merges may have renamed things).
//
//   "targetOverrides": { dealId: [assetId, ...] }
//     — replaces that deal's role='target' participant rows with rows for the
//       listed assets (mirror of buyerOverrides). Unknown deal or asset ids
//       flag and keep the original targets. Stakes derivation runs afterwards,
//       so seller pre-history synthesis lands on the child assets, and the
//       deal's `display` block keeps the original annotated names for the UI.

export function injectNewAssets(reg, newAssets) {
  const flags = []
  for (const a of newAssets ?? []) {
    const key = a.id.replace(/^asset-/, '')
    if (reg.assets.has(key)) {
      flags.push(`new asset ${a.id}: duplicate id against harvested asset, skipped`)
      continue
    }
    reg.assets.set(key, {
      id: a.id, name: a.name, aliases: [],
      type: a.type ?? null, ticker: a.ticker ?? null,
      parentAssetId: a.parentAssetId ?? null, successorAssetId: null,
    })
  }
  return { flags }
}

export function applyTargetOverrides(participants, targetOverrides, reg, dealIds) {
  const flags = []
  for (const [dealId, assetIds] of Object.entries(targetOverrides ?? {})) {
    if (!dealIds.has(dealId)) {
      flags.push(`target override ${dealId}: unknown deal id, skipped`)
      continue
    }
    const unknown = assetIds.filter(id => !reg.assets.has(id.replace(/^asset-/, '')))
    if (unknown.length) {
      flags.push(`target override ${dealId}: unknown asset ${unknown.join(', ')} — original targets kept`)
      continue
    }
    const firstIdx = participants.findIndex(p => p.dealId === dealId && p.role === 'target')
    for (let i = participants.length - 1; i >= 0; i--) {
      if (participants[i].dealId === dealId && participants[i].role === 'target') participants.splice(i, 1)
    }
    const rows = assetIds.map(partyId =>
      ({ pct: null, fundId: null, partyType: 'asset', partyId, role: 'target', dealId }))
    participants.splice(firstIdx === -1 ? participants.length : firstIdx, 0, ...rows)
  }
  return { flags }
}

export function validateParentAssets(reg) {
  const flags = []
  const ids = new Set([...reg.assets.values()].map(a => a.id))
  for (const a of reg.assets.values()) {
    if (a.parentAssetId != null && !ids.has(a.parentAssetId)) {
      flags.push(`asset ${a.id}: parentAssetId ${a.parentAssetId} not found — dangling parent`)
    }
  }
  return { flags }
}
