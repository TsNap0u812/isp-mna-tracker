// ── Fund capital metrics (pure JS, no React) ─────────────────────────────────
// Committed-capital precedence, deployment resolution (actual called capital
// vs vintage age-curve estimate), and the dry-powder formula shared by
// FundMgmtPage and tests.

/**
 * Estimate % of capital deployed based on fund vintage year.
 * Calibrated to typical infrastructure fund deployment pace
 * (slower than PE buyout — infra funds hold assets 7-15 yrs).
 */
export function estDeployedPct(vintage) {
  if (!vintage) return null
  const age = 2026 - vintage
  if (age >= 7) return 0.94
  if (age >= 6) return 0.88
  if (age >= 5) return 0.80
  if (age >= 4) return 0.70
  if (age >= 3) return 0.56
  if (age >= 2) return 0.38
  if (age >= 1) return 0.20
  return 0.08
}

/**
 * Pick committed capital by source precedence:
 *   max lpDisclosures.committedM ($M) → CalPERS committed ($) →
 *   Form D totalAmountSold ($) → announcedFunds sizeUSD ($, isAnnounced).
 * Returns { committedM, committedSource, sourceLabel, isAnnounced }.
 */
export function resolveCommitted({ lpRows = [], calpersRow = null, formDRow = null, announcedFund = null } = {}) {
  const lpBest = lpRows
    .filter(r => r?.committedM != null && r.committedM > 0)
    .sort((a, b) => b.committedM - a.committedM)[0] ?? null
  if (lpBest) {
    return {
      committedM: lpBest.committedM,
      committedSource: 'LP disclosure',
      sourceLabel: [lpBest.source, lpBest.asOf ? `as of ${lpBest.asOf}` : null].filter(Boolean).join(' ') || 'LP disclosure',
      isAnnounced: false,
    }
  }
  if (calpersRow?.committed > 0) {
    return {
      committedM: calpersRow.committed / 1e6,
      committedSource: 'CalPERS',
      sourceLabel: 'CalPERS',
      isAnnounced: false,
    }
  }
  if (formDRow?.totalAmountSold > 0) {
    return {
      committedM: formDRow.totalAmountSold / 1e6,
      committedSource: 'Form D',
      sourceLabel: 'SEC Form D',
      isAnnounced: false,
    }
  }
  if (announcedFund?.sizeUSD > 0) {
    return {
      committedM: announcedFund.sizeUSD / 1e6,
      committedSource: 'Announced',
      sourceLabel: 'Announced (press)',
      isAnnounced: true,
    }
  }
  return { committedM: null, committedSource: null, sourceLabel: null, isAnnounced: false }
}

/**
 * Pick deployment. Actual when any source provides called capital:
 *   max calledM across LP rows ($M) + CalPERS called ($) → deployedM,
 *   deployedPct = called / committed, isActual true.
 * Otherwise fall back to the estDeployedPct vintage age curve.
 * Returns { deployedM, deployedPct, isActual }.
 */
export function resolveDeployment({ lpRows = [], calpersRow = null, committedM = null, vintage = null } = {}) {
  const calledCandidates = lpRows
    .map(r => r?.calledM)
    .filter(v => v != null && v > 0)
  if (calpersRow?.called > 0) calledCandidates.push(calpersRow.called / 1e6)

  if (calledCandidates.length) {
    const calledM = Math.max(...calledCandidates)
    return {
      deployedM: calledM,
      deployedPct: committedM > 0 ? calledM / committedM : null,
      isActual: true,
    }
  }

  const pct = estDeployedPct(vintage)
  return {
    deployedM: committedM != null && pct != null ? committedM * pct : null,
    deployedPct: pct,
    isActual: false,
  }
}

/**
 * Dry powder = committed − deployed − 10% reserves (follow-ons), floored at 0.
 * Returns { reservesM, dryPowderM }.
 */
export function computeDryPowder({ committedM = null, deployedM = null } = {}) {
  if (committedM == null) return { reservesM: null, dryPowderM: null }
  const reservesM = committedM * 0.10
  const dryPowderM = deployedM != null
    ? Math.max(committedM - deployedM - reservesM, 0)
    : null
  return { reservesM, dryPowderM }
}
