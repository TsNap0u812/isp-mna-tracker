// scripts/migrate/validate.mjs — input validation for the deal authoring path.
// Runs against the combined input (frozen legacy snapshot + src/data/new-deals.json)
// before the migration pipeline touches anything.

export const KNOWN_STATUSES = [
  'Completed',
  'Completing',
  'Pending / Regulatory Review',
  'Rumored / In Discussions',
  'Terminated',
]

export const KNOWN_DEAL_TYPES = [
  'Acquisition',
  'Merger',
  'Asset Acquisition',
  'Joint Venture',
  'Recapitalization',
  'Consolidation',
  'Partial Stake Sale',
]

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const isBlank = v => typeof v !== 'string' || v.trim() === ''

/**
 * Validate the combined deal input. Returns { errors: [] } — empty means clean.
 * Each error is a human-readable string prefixed with the deal's id (or index
 * when the id itself is missing).
 */
export function validateInput(deals) {
  const errors = []
  const seenIds = new Set()

  deals.forEach((d, i) => {
    const label = isBlank(d.id) ? `input[${i}]` : d.id

    if (isBlank(d.id)) {
      errors.push(`${label}: missing or empty "id"`)
    } else if (seenIds.has(d.id)) {
      errors.push(`${label}: duplicate id "${d.id}"`)
    } else {
      seenIds.add(d.id)
    }

    if (isBlank(d.date)) {
      errors.push(`${label}: missing or empty "date"`)
    } else if (!DATE_RE.test(d.date)) {
      errors.push(`${label}: date "${d.date}" is not YYYY-MM-DD`)
    }

    if (isBlank(d.status)) {
      errors.push(`${label}: missing or empty "status"`)
    } else if (!KNOWN_STATUSES.includes(d.status)) {
      errors.push(`${label}: unknown status "${d.status}" — expected one of: ${KNOWN_STATUSES.join(', ')}`)
    }

    if (!isBlank(d.dealType) && !KNOWN_DEAL_TYPES.includes(d.dealType)) {
      errors.push(`${label}: unknown dealType "${d.dealType}" — expected one of: ${KNOWN_DEAL_TYPES.join(', ')}`)
    }

    if (isBlank(d.acquirer?.name)) errors.push(`${label}: missing or empty "acquirer.name"`)
    if (isBlank(d.acquired?.name)) errors.push(`${label}: missing or empty "acquired.name"`)
  })

  return { errors }
}
