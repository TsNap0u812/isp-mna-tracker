import firms from './db/firms.json'
import funds from './db/funds.json'
import assets from './db/assets.json'
import deals from './db/deals.json'
import participants from './db/participants.json'
import stakes from './db/stakes.json'

const index = coll => new Map(coll.map(x => [x.id, x]))

export const db = {
  firms, funds, assets, deals, participants, stakes,
  firm: index(firms), fund: index(funds), asset: index(assets), deal: index(deals),
}

export const partyName = p =>
  (p.partyType === 'firm' ? db.firm : db.asset).get(p.partyId)?.name ?? p.partyId

export const participantsOf = dealId => participants.filter(p => p.dealId === dealId)

// Stakes active at a date (default: now). Pre-history stakes (startDate null)
// count as active for any date before their endDate.
export function openStakes(asOf = null) {
  return stakes.filter(s =>
    (s.endDate === null || (asOf != null && s.endDate > asOf)) &&
    (asOf == null ? s.endDate === null : (s.startDate === null || s.startDate <= asOf)))
}

export function portfolioOf(ownerId, asOf = null) {
  const ids = new Set(openStakes(asOf).filter(s => s.ownerId === ownerId).map(s => s.assetId))
  return [...ids].map(id => db.asset.get(id)).filter(Boolean)
}

export const fundsOf = firmId => funds.filter(f => f.sponsorFirmIds.includes(firmId))

// All deals touching an asset's full lineage (successors forward, predecessors
// and child systems backward), newest first.
export function evolutionChain(assetId) {
  const lineage = new Set([assetId])
  const queue = [assetId]
  while (queue.length) {
    const id = queue.pop()
    const a = db.asset.get(id)
    if (a?.successorAssetId && !lineage.has(a.successorAssetId)) {
      lineage.add(a.successorAssetId); queue.push(a.successorAssetId)
    }
    for (const p of assets) {
      if ((p.successorAssetId === id || p.parentAssetId === id) && !lineage.has(p.id)) {
        lineage.add(p.id); queue.push(p.id)
      }
    }
  }
  const dealIds = new Set(
    participants.filter(p => p.partyType === 'asset' && lineage.has(p.partyId)).map(p => p.dealId))
  return deals.filter(d => dealIds.has(d.id)).sort((a, b) => b.date.localeCompare(a.date))
}

// Bridge: reconstruct the legacy deal shape so existing pages keep working.
// Portfolios come from live stakes — they can never go stale.
export function legacyDeals() {
  return deals.map(d => {
    const ps = participantsOf(d.id)
    const buyerFirm = ps.find(p => (p.role === 'buyer' || p.role === 'backer') && p.partyType === 'firm')
    const sellerFirm = ps.find(p => p.role === 'seller' && p.partyType === 'firm')
    const peBlock = ref => {
      if (!ref) return null
      const f = db.firm.get(ref.partyId)
      if (!f) return null
      return {
        firm: f.name, firmType: f.firmType, aum: f.aum,
        headquarters: f.headquarters, website: f.website,
        primaryFunds: fundsOf(f.id).map(x => x.name),
        otherTelecomPortfolio: portfolioOf(f.id).map(a => a.name),
      }
    }
    return {
      id: d.id, date: d.date, status: d.status, dealType: d.dealType,
      dealValue: d.valueUSD, ownershipPct: d.ownershipPct,
      geography: d.geography, subscribers: d.subscribers,
      reason: d.reason, strategicImportance: d.strategicImportance,
      keyTerms: d.keyTerms, notes: d.notes,
      acquirer: { name: d.display.acquirerName, type: d.display.acquirerType,
        ticker: d.display.acquirerTicker, pe: peBlock(buyerFirm) },
      acquired: { name: d.display.acquiredName, type: d.display.acquiredType,
        ticker: d.display.acquiredTicker, pe: peBlock(sellerFirm) },
    }
  })
}
