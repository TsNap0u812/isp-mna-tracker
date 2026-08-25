// Derive dated ownership stakes from participant rows.
//
// Semantics:
//   participants `pct` is a FRACTION (0..1); stake `pct` is a PERCENT (0..100):
//     stake.pct = buyer.pct × deal.ownershipPct
//   A stake with endDate null is currently held.
//   startDate null means pre-history (owned before the tracked window).
//   Consolidation deals open the buyer stake on the SUCCESSOR asset, not the predecessors.
//   When a deal has a seller but the asset has no open stake, a pre-history stake is
//   synthesized for the seller first, then closed — backfilling ownership that predates the dataset.

export function deriveStakes(deals, participants) {
  const stakes = []
  const flags = []
  let n = 0

  const newStake = s => {
    const st = { id: `stake-${String(++n).padStart(3, '0')}`,
      endDate: null, closedByDealId: null, ...s }
    stakes.push(st)
    return st
  }

  const openOn = assetId => stakes.filter(s => s.assetId === assetId && s.endDate === null)

  const completed = deals
    .filter(d => d.status === 'Completed')
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))

  for (const deal of completed) {
    const parts = participants.filter(p => p.dealId === deal.id)
    const buyers = parts.filter(p => p.role === 'buyer')
    const targets = parts.filter(p => p.role === 'target')
    const sellers = parts.filter(p => p.role === 'seller')
    const successor = parts.find(p => p.role === 'successor')
    const ownPct = deal.ownershipPct ?? 100
    const full = ownPct >= 100

    for (const t of targets) {
      let open = openOn(t.partyId)
      if (open.length === 0 && sellers.length > 0) {
        for (const s of sellers) {
          newStake({ assetId: t.partyId, ownerType: s.partyType, ownerId: s.partyId,
            pct: null, startDate: null, openedByDealId: null })
        }
        open = openOn(t.partyId)
        flags.push(`${deal.id}: synthesized pre-history stake for seller(s) on ${t.partyId}`)
      }
      if (full) {
        open.forEach(s => { s.endDate = deal.date; s.closedByDealId = deal.id })
      } else if (open.length > 0) {
        flags.push(`${deal.id}: partial deal (${ownPct}%) — prior stakes on ${t.partyId} left open, review`)
      }
    }

    if (buyers.length > 1 && buyers.some(b => b.pct == null)) flags.push(`${deal.id}: multi-buyer deal with missing pct — stakes default to full ownPct each, review`)

    const stakeAssetIds = successor ? [successor.partyId] : targets.map(t => t.partyId)
    for (const assetId of stakeAssetIds) {
      for (const b of buyers) {
        newStake({ assetId, ownerType: b.partyType, ownerId: b.partyId,
          pct: +(((b.pct ?? 1) * ownPct)).toFixed(2),
          startDate: deal.date, openedByDealId: deal.id })
      }
    }
  }

  return { stakes, flags }
}
