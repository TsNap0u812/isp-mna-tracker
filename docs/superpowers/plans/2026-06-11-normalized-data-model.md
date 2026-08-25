# Normalized Temporal Data Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the ISP M&A tracker from a denormalized deal-centric `deals.json` to six normalized collections (firms, funds, assets, deals, participants, ownership stakes) with a `db.js` join layer, so ownership over time is queried — never hand-maintained.

**Architecture:** A one-time, re-runnable migration script parses the legacy `src/data/deals.json` into `src/data/db/*.json`, flagging every ambiguity in a report and accepting manual corrections via an overrides file. A pure-JS selector layer (`src/data/db.js`) joins the collections and exposes a `legacyDeals()` bridge that reconstructs the old deal shape — with portfolios derived live from stakes — so the whole app keeps working immediately. Pages then port one at a time to direct selectors, deleting their string-matching workarounds.

**Tech Stack:** React 18 + Vite (existing), Vitest (new dev dependency), plain JSON collections, Node ESM scripts.

---

## Context: current state

- `src/App.jsx:3` imports `staticDeals from './data/deals.json'` (50 deals), merges with localStorage deals from `useLocalDeals`, passes the merged array as `deals` prop to every page.
- Each legacy deal embeds `acquirer`/`acquired` objects with optional `pe` blobs. The same firm (e.g. TPG Capital) appears as ~6 divergent blobs; ownership lives in annotated strings like `"Astound Broadband (sold to Stonepeak 2021)"` inside `otherTelecomPortfolio` arrays.
- `src/data/deals.js` duplicates the data and also exports `ISP_TYPES`, `DEAL_TYPES`, `STATUSES` constants used by `DealForm.jsx` and `FilterBar.jsx`.
- `api/server.mjs:183` reads `src/data/deals.json` for refresh-comparison only.
- No test framework is installed.
- Deal vocabulary in the data: statuses `Completed | Pending / Regulatory Review | Terminated`; dealTypes `Acquisition | Merger | Asset Acquisition | Joint Venture | Recapitalization | Consolidation | Partial Stake Sale`.

## Target schema (lock this in — all tasks use these exact shapes)

All files live in `src/data/db/`. All ids are slugs with a type prefix.

```jsonc
// firms.json — one record per PE firm or strategic sponsor
{ "id": "firm-tpg-capital", "name": "TPG Capital", "aliases": [],
  "firmType": "Private Equity", "aum": "$185B+",
  "headquarters": "Fort Worth, TX", "website": "tpg.com" }

// funds.json — sponsorFirmIds is an array so co-led funds are ONE record
{ "id": "fund-tpg-8", "name": "TPG Capital VIII", "number": 8,
  "sponsorFirmIds": ["firm-tpg-capital"] }

// assets.json — operating companies and systems; two self-references for lineage
{ "id": "asset-astound-broadband", "name": "Astound Broadband",
  "aliases": ["Astound Broadband (from TPG Capital)"],
  "type": "MSO (Cable) / Fiber", "ticker": null,
  "parentAssetId": null, "successorAssetId": null }

// deals.json — no embedded parties; display block keeps the original strings for the UI
{ "id": "deal-052", "date": "2021-08-01", "status": "Completed",
  "dealType": "Acquisition", "valueUSD": 8100000000, "ownershipPct": 100,
  "geography": ["NY"], "subscribers": 1100000,
  "reason": "…", "strategicImportance": "…", "keyTerms": "…", "notes": "…",
  "display": { "acquirerName": "Stonepeak Infrastructure Partners",
               "acquirerType": "Infrastructure Private Equity", "acquirerTicker": null,
               "acquiredName": "Astound Broadband (from TPG Capital)",
               "acquiredType": "MSO (Cable) / Fiber", "acquiredTicker": null } }

// participants.json — one row per party per deal.
// roles: buyer | seller | target | backer | successor
// pct is a FRACTION of the acquired stake (0..1), null when not applicable
{ "dealId": "deal-052", "partyType": "firm",
  "partyId": "firm-stonepeak-infrastructure-partners",
  "role": "buyer", "pct": 1, "fundId": null }

// stakes.json — the temporal core. pct is a PERCENT (0..100).
// endDate null = currently held. startDate null = pre-history (owned before tracked window).
{ "id": "stake-001", "assetId": "asset-astound-broadband",
  "ownerType": "firm", "ownerId": "firm-stonepeak-infrastructure-partners",
  "pct": 100, "startDate": "2021-08-01", "endDate": null,
  "openedByDealId": "deal-052", "closedByDealId": null }
```

## File structure

| File | Responsibility |
|---|---|
| `scripts/migrate/helpers.mjs` | Pure string functions: slugify, baseName, compound splitting, fund numbers |
| `scripts/migrate/harvest.mjs` | Entity registry: upsert firms/funds/assets, party classification |
| `scripts/migrate/participants.mjs` | Per-deal participant rows + ambiguity flags |
| `scripts/migrate/stakes.mjs` | Derive dated ownership stakes from participants |
| `scripts/migrate/overrides.json` | Reviewed manual corrections (asset merges) consumed by the orchestrator |
| `scripts/migrate/index.mjs` | Orchestrator: read legacy file → passes → write db/*.json + report |
| `src/data/db/*.json` | Generated collections (committed) |
| `src/data/db.js` | Selector layer: indexes, portfolioOf, evolutionChain, legacyDeals |
| `docs/migration-report.md` | Generated: counts + every flagged guess |
| `tests/helpers.test.js`, `tests/harvest.test.js`, `tests/participants.test.js`, `tests/stakes.test.js`, `tests/db.test.js` | Vitest suites |

## Out of scope (v1)

- **FundMgmtPage deep port** — its `fund-data.json` enrichment (SEC Form D / CalPERS) is keyed by raw firm strings; re-keying to firmIds is a follow-up plan. The page keeps working via the `legacyDeals()` bridge.
- **DealForm writing normalized records** — locally-added deals stay legacy-shaped and merge into the legacy view unchanged.
- **api/server.mjs port** — it keeps reading the frozen legacy `src/data/deals.json` for refresh comparison.
- SQLite. The model transfers 1:1 if needed later.

---

### Task 1: Vitest setup

**Files:**
- Modify: `package.json`
- Create: `tests/smoke.test.js`

- [ ] **Step 1: Install vitest**

Run: `npm install -D vitest`

- [ ] **Step 2: Add test script**

In `package.json` `"scripts"`, after the `"fund-data:dry"` entry, add:

```json
"test": "vitest run"
```

- [ ] **Step 3: Write smoke test**

```js
// tests/smoke.test.js
import { describe, it, expect } from 'vitest'
import deals from '../src/data/deals.json'

describe('legacy data sanity', () => {
  it('loads the legacy deals file', () => {
    expect(deals.length).toBeGreaterThanOrEqual(50)
    expect(deals[0]).toHaveProperty('id')
    expect(deals[0]).toHaveProperty('acquirer.name')
  })
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: 1 passed

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tests/smoke.test.js
git commit -m "chore: add vitest with legacy-data smoke test"
```

---

### Task 2: Migration string helpers

**Files:**
- Create: `scripts/migrate/helpers.mjs`
- Test: `tests/helpers.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/helpers.test.js
import { describe, it, expect } from 'vitest'
import { slugify, baseName, assetKey, splitCompoundFirm, extractFundNum }
  from '../scripts/migrate/helpers.mjs'

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('TPG Capital')).toBe('tpg-capital')
    expect(slugify('KKR & Co. Inc.')).toBe('kkr-and-co-inc')
  })
})

describe('baseName', () => {
  it('strips parenthetical groups but keeps words outside them', () => {
    expect(baseName('Astound Broadband (from TPG Capital)')).toBe('Astound Broadband')
    expect(baseName('WideOpenWest (WOW!) Chicago-Area Cable System'))
      .toBe('WideOpenWest Chicago-Area Cable System')
  })
})

describe('splitCompoundFirm', () => {
  it('splits on slash and plus separators', () => {
    expect(splitCompoundFirm('Oak Hill Capital + Pamlico Capital'))
      .toEqual(['Oak Hill Capital', 'Pamlico Capital'])
    expect(splitCompoundFirm('Apax Partners / Warburg Pincus / CPPIB Consortium'))
      .toEqual(['Apax Partners', 'Warburg Pincus', 'CPPIB Consortium'])
  })
  it('does not split on ampersands and strips parens first', () => {
    expect(splitCompoundFirm('KKR & Co. / Ares Management'))
      .toEqual(['KKR & Co.', 'Ares Management'])
    expect(splitCompoundFirm('EQT Infrastructure / DigitalBridge (co-lead)'))
      .toEqual(['EQT Infrastructure', 'DigitalBridge'])
  })
  it('returns single-element array for simple names', () => {
    expect(splitCompoundFirm('TPG Capital (Astound Broadband Formation)'))
      .toEqual(['TPG Capital'])
  })
})

describe('extractFundNum', () => {
  it('parses trailing roman numerals and digits', () => {
    expect(extractFundNum('TPG Capital VIII')).toBe(8)
    expect(extractFundNum('Crestview Partners IV')).toBe(4)
    expect(extractFundNum('Stonepeak Infrastructure Fund 4')).toBe(4)
  })
  it('returns null when there is no number', () => {
    expect(extractFundNum('Apollo Global Management')).toBe(null)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/helpers.test.js`
Expected: FAIL — cannot find module `scripts/migrate/helpers.mjs`

- [ ] **Step 3: Implement helpers**

```js
// scripts/migrate/helpers.mjs
export const slugify = s => s.toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

export const baseName = s => s
  .replace(/\s*\([^)]*\)/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const assetKey = name => slugify(baseName(name))

// Split "A / B" and "A + B" (spaces required around + so "T-Mobile+KKR"-style
// names without spaces still split, but hyphens inside words never do).
export function splitCompoundFirm(name) {
  return baseName(name)
    .split(/\s*\/\s*|\s+\+\s+/)
    .map(s => s.trim())
    .filter(Boolean)
}

const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7,
                viii: 8, ix: 9, x: 10, xi: 11, xii: 12 }

export function extractFundNum(name) {
  const m = baseName(name).match(/\b(x{0,2}(?:i[xv]|v?i{1,3}|v|x)|\d+)$/i)
  if (!m) return null
  const tok = m[1].toLowerCase()
  if (/^\d+$/.test(tok)) return parseInt(tok, 10)
  return ROMAN[tok] ?? null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/helpers.test.js`
Expected: all PASS. If `extractFundNum('Apollo Global Management')` fails because the regex matched a word ending, tighten the regex until the listed cases pass — the test file is the contract.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate/helpers.mjs tests/helpers.test.js
git commit -m "feat: migration string helpers (slugify, compound split, fund numbers)"
```

---

### Task 3: Entity registry and harvesting

**Files:**
- Create: `scripts/migrate/harvest.mjs`
- Test: `tests/harvest.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/harvest.test.js
import { describe, it, expect } from 'vitest'
import { createRegistry, upsertFirm, upsertFund, upsertAsset, classifyParty, sponsorFor }
  from '../scripts/migrate/harvest.mjs'

const TPG_PE = { firm: 'TPG Capital', firmType: 'Private Equity', aum: '$185B+',
  primaryFunds: ['TPG Capital VIII'], headquarters: 'Fort Worth, TX', website: 'tpg.com' }

describe('upsertFirm', () => {
  it('creates one record per firm and enriches from pe blob', () => {
    const reg = createRegistry()
    const [f] = upsertFirm(reg, 'TPG Capital', TPG_PE)
    expect(f.id).toBe('firm-tpg-capital')
    expect(f.aum).toBe('$185B+')
    expect(reg.firms.size).toBe(1)
  })
  it('splits compound names into separate firms', () => {
    const reg = createRegistry()
    const firms = upsertFirm(reg, 'Oak Hill Capital + Pamlico Capital', null)
    expect(firms.map(f => f.id))
      .toEqual(['firm-oak-hill-capital', 'firm-pamlico-capital'])
  })
  it('is idempotent — same firm twice yields one record', () => {
    const reg = createRegistry()
    upsertFirm(reg, 'TPG Capital', TPG_PE)
    upsertFirm(reg, 'TPG Capital (Astound Broadband Formation)', null)
    expect(reg.firms.size).toBe(1)
  })
})

describe('upsertFund', () => {
  it('dedupes co-led funds by first word + number with multiple sponsors', () => {
    const reg = createRegistry()
    const [crestview] = upsertFirm(reg, 'Crestview Partners', null)
    const [digital] = upsertFirm(reg, 'DigitalBridge Group', null)
    const f1 = upsertFund(reg, 'Crestview Partners IV', [crestview])
    const f2 = upsertFund(reg, 'Crestview Partners IV', [digital, crestview])
    expect(f1).toBe(f2)
    expect(f1.sponsorFirmIds)
      .toEqual(['firm-crestview-partners', 'firm-digitalbridge-group'])
    expect(reg.funds.size).toBe(1)
  })
})

describe('upsertAsset', () => {
  it('keys by base name and accumulates aliases', () => {
    const reg = createRegistry()
    upsertAsset(reg, { name: 'Astound Broadband', type: 'MSO (Cable) / Fiber', ticker: null })
    const a = upsertAsset(reg, { name: 'Astound Broadband (from TPG Capital)', type: null, ticker: null })
    expect(reg.assets.size).toBe(1)
    expect(a.aliases).toContain('Astound Broadband (from TPG Capital)')
  })
  it('keeps partial-system names distinct from the parent company', () => {
    const reg = createRegistry()
    upsertAsset(reg, { name: 'WideOpenWest (WOW!)', type: 'MSO (Cable)', ticker: 'WOW' })
    upsertAsset(reg, { name: 'WideOpenWest (WOW!) Chicago-Area Cable System', type: 'MSO (Cable)', ticker: null })
    expect(reg.assets.size).toBe(2)
  })
})

describe('classifyParty', () => {
  it('matches a registered firm by first word', () => {
    const reg = createRegistry()
    upsertFirm(reg, 'KKR & Co. Inc.', null)
    expect(classifyParty(reg, 'KKR').kind).toBe('firm')
    expect(classifyParty(reg, 'T-Mobile US').kind).toBe('asset')
  })
})

describe('sponsorFor', () => {
  it('picks the firm whose name starts with the fund first word', () => {
    const reg = createRegistry()
    const firms = upsertFirm(reg, 'Oak Hill Capital + Pamlico Capital', null)
    expect(sponsorFor('Pamlico Capital Fund VI', firms).id).toBe('firm-pamlico-capital')
    expect(sponsorFor('Oak Hill Capital Partners V', firms).id).toBe('firm-oak-hill-capital')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/harvest.test.js`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement harvest.mjs**

```js
// scripts/migrate/harvest.mjs
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
      reg.flags.push(`firm enrichment skipped for compound "${name}" — assign firmType/aum manually`)
    }
    return f
  })
}

export function sponsorFor(fundName, firms) {
  const fw = fundName.split(/\s+/)[0].toLowerCase()
  return firms.find(f => f.name.toLowerCase().startsWith(fw)) ?? firms[0]
}

export function upsertFund(reg, fundName, sponsorFirms) {
  const num = extractFundNum(fundName)
  const fw = fundName.split(/\s+/)[0].toLowerCase()
  const key = num != null ? `${fw}-${num}` : slugify(fundName)
  if (!reg.funds.has(key)) {
    reg.funds.set(key, { id: `fund-${key}`, name: fundName, number: num, sponsorFirmIds: [] })
  }
  const fund = reg.funds.get(key)
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
  const fw = baseName(name).split(/\s+/)[0].toLowerCase()
  for (const f of reg.firms.values()) {
    if (f.name.split(/\s+/)[0].toLowerCase() === fw) return { kind: 'firm', record: f }
  }
  return { kind: 'asset', record: null }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/harvest.test.js`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate/harvest.mjs tests/harvest.test.js
git commit -m "feat: entity registry — firm/fund/asset harvesting with dedup"
```

---

### Task 4: Participant rows per deal

**Files:**
- Create: `scripts/migrate/participants.mjs`
- Test: `tests/participants.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/participants.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { createRegistry, upsertFirm } from '../scripts/migrate/harvest.mjs'
import { buildDealParticipants } from '../scripts/migrate/participants.mjs'

let reg
beforeEach(() => {
  reg = createRegistry()
  // pass-1 firms already harvested
  upsertFirm(reg, 'TPG Capital', { firm: 'TPG Capital', firmType: 'Private Equity' })
  upsertFirm(reg, 'Stonepeak Infrastructure Partners',
    { firm: 'Stonepeak Infrastructure Partners', firmType: 'Infrastructure Private Equity' })
  upsertFirm(reg, 'KKR & Co. Inc.', { firm: 'KKR & Co. Inc.', firmType: 'Private Equity' })
})

const DEAL_052 = {
  id: 'deal-052', date: '2021-08-01', status: 'Completed', dealType: 'Acquisition',
  acquirer: { name: 'Stonepeak Infrastructure Partners', type: 'Infrastructure Private Equity', ticker: null, pe: null },
  acquired: { name: 'Astound Broadband (from TPG Capital)', type: 'MSO (Cable) / Fiber', ticker: null,
    pe: { firm: 'TPG Capital', firmType: 'Private Equity' } },
  ownershipPct: 100,
}

it('emits buyer, target and seller rows for a sponsor-to-sponsor sale', () => {
  const { rows } = buildDealParticipants(DEAL_052, reg)
  expect(rows).toContainEqual({ dealId: 'deal-052', partyType: 'firm',
    partyId: 'firm-stonepeak-infrastructure-partners', role: 'buyer', pct: 1, fundId: null })
  expect(rows).toContainEqual({ dealId: 'deal-052', partyType: 'asset',
    partyId: 'asset-astound-broadband', role: 'target', pct: null, fundId: null })
  expect(rows).toContainEqual({ dealId: 'deal-052', partyType: 'firm',
    partyId: 'firm-tpg-capital', role: 'seller', pct: null, fundId: null })
})

it('splits compound buyers 50/50 with a flag', () => {
  const jv = { id: 'deal-jv', date: '2024-07-01', status: 'Completed', dealType: 'Joint Venture',
    acquirer: { name: 'T-Mobile US + KKR', type: 'Wireless Carrier', ticker: null, pe: null },
    acquired: { name: 'MetroNet', type: 'Pure Fiber (FTTH)', ticker: null, pe: null }, ownershipPct: 100 }
  const { rows, flags } = buildDealParticipants(jv, reg)
  const buyers = rows.filter(r => r.role === 'buyer')
  expect(buyers).toHaveLength(2)
  expect(buyers.map(b => b.pct)).toEqual([0.5, 0.5])
  expect(buyers.find(b => b.partyType === 'firm').partyId).toBe('firm-kkr-and-co-inc')
  expect(buyers.find(b => b.partyType === 'asset').partyId).toBe('asset-t-mobile-us')
  expect(flags.some(f => f.includes('compound buyer'))).toBe(true)
})

it('splits consolidation targets and records the successor', () => {
  const cons = { id: 'deal-032', date: '2021-04-01', status: 'Completed', dealType: 'Consolidation',
    acquirer: { name: 'TPG Capital (Astound Broadband Formation)', type: 'MSO (Cable) / Fiber', ticker: null,
      pe: { firm: 'TPG Capital', firmType: 'Private Equity' } },
    acquired: { name: 'RCN Telecom + WaveDivision + Grande Communications (Consolidated into Astound)',
      type: 'MSO (Cable) / Fiber', ticker: null, pe: null }, ownershipPct: 100 }
  const { rows } = buildDealParticipants(cons, reg)
  const targets = rows.filter(r => r.role === 'target').map(r => r.partyId)
  expect(targets).toEqual(['asset-rcn-telecom', 'asset-wavedivision', 'asset-grande-communications'])
  expect(rows.find(r => r.role === 'successor').partyId).toBe('asset-astound')
  expect(rows.find(r => r.role === 'buyer').partyId).toBe('firm-tpg-capital')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/participants.test.js`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement participants.mjs**

```js
// scripts/migrate/participants.mjs
import { slugify, assetKey, splitCompoundFirm } from './helpers.mjs'
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/participants.test.js`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate/participants.mjs tests/participants.test.js
git commit -m "feat: per-deal participant extraction with ambiguity flags"
```

---

### Task 5: Stake derivation

**Files:**
- Create: `scripts/migrate/stakes.mjs`
- Test: `tests/stakes.test.js`

- [ ] **Step 1: Write failing tests** — the Astound chain is the canonical case

```js
// tests/stakes.test.js
import { describe, it, expect } from 'vitest'
import { deriveStakes } from '../scripts/migrate/stakes.mjs'

const DEALS = [
  { id: 'd-cons', date: '2021-04-01', status: 'Completed', dealType: 'Consolidation', ownershipPct: 100 },
  { id: 'd-sale', date: '2021-08-01', status: 'Completed', dealType: 'Acquisition', ownershipPct: 100 },
  { id: 'd-rumor', date: '2025-01-01', status: 'Pending / Regulatory Review', dealType: 'Merger', ownershipPct: 100 },
]
const PARTS = [
  { dealId: 'd-cons', partyType: 'firm', partyId: 'firm-tpg', role: 'buyer', pct: 1, fundId: null },
  { dealId: 'd-cons', partyType: 'asset', partyId: 'asset-rcn', role: 'target', pct: null, fundId: null },
  { dealId: 'd-cons', partyType: 'asset', partyId: 'asset-wave', role: 'target', pct: null, fundId: null },
  { dealId: 'd-cons', partyType: 'asset', partyId: 'asset-astound', role: 'successor', pct: null, fundId: null },
  { dealId: 'd-sale', partyType: 'firm', partyId: 'firm-stonepeak', role: 'buyer', pct: 1, fundId: null },
  { dealId: 'd-sale', partyType: 'asset', partyId: 'asset-astound', role: 'target', pct: null, fundId: null },
  { dealId: 'd-sale', partyType: 'firm', partyId: 'firm-tpg', role: 'seller', pct: null, fundId: null },
  { dealId: 'd-rumor', partyType: 'asset', partyId: 'asset-astound', role: 'target', pct: null, fundId: null },
]

describe('deriveStakes — Astound chain', () => {
  const { stakes } = deriveStakes(DEALS, PARTS)

  it('consolidation opens the buyer stake on the successor asset', () => {
    const tpg = stakes.find(s => s.ownerId === 'firm-tpg' && s.assetId === 'asset-astound')
    expect(tpg.startDate).toBe('2021-04-01')
    expect(tpg.openedByDealId).toBe('d-cons')
  })

  it('the sale closes the seller stake and opens the buyer stake', () => {
    const tpg = stakes.find(s => s.ownerId === 'firm-tpg' && s.assetId === 'asset-astound')
    expect(tpg.endDate).toBe('2021-08-01')
    expect(tpg.closedByDealId).toBe('d-sale')
    const sp = stakes.find(s => s.ownerId === 'firm-stonepeak')
    expect(sp.assetId).toBe('asset-astound')
    expect(sp.endDate).toBe(null)
    expect(sp.pct).toBe(100)
  })

  it('non-completed deals produce no stakes', () => {
    expect(stakes.some(s => s.openedByDealId === 'd-rumor')).toBe(false)
  })
})

describe('deriveStakes — pre-history synthesis', () => {
  it('synthesizes a seller stake when the asset has no tracked opening', () => {
    const deals = [{ id: 'd1', date: '2021-05-01', status: 'Completed', dealType: 'Acquisition', ownershipPct: 100 }]
    const parts = [
      { dealId: 'd1', partyType: 'firm', partyId: 'firm-buyer', role: 'buyer', pct: 1, fundId: null },
      { dealId: 'd1', partyType: 'asset', partyId: 'asset-x', role: 'target', pct: null, fundId: null },
      { dealId: 'd1', partyType: 'firm', partyId: 'firm-old-owner', role: 'seller', pct: null, fundId: null },
    ]
    const { stakes, flags } = deriveStakes(deals, parts)
    const pre = stakes.find(s => s.ownerId === 'firm-old-owner')
    expect(pre.startDate).toBe(null)
    expect(pre.openedByDealId).toBe(null)
    expect(pre.endDate).toBe('2021-05-01')
    expect(flags.some(f => f.includes('pre-history'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/stakes.test.js`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement stakes.mjs**

```js
// scripts/migrate/stakes.mjs

// participants pct is a fraction (0..1); stake pct is a percent (0..100):
//   stake.pct = buyer.pct × deal.ownershipPct
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
    .sort((a, b) => a.date.localeCompare(b.date))

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/stakes.test.js`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate/stakes.mjs tests/stakes.test.js
git commit -m "feat: temporal stake derivation with pre-history synthesis"
```

---

### Task 6: Orchestrator, overrides, and the actual migration

**Files:**
- Create: `scripts/migrate/overrides.json`
- Create: `scripts/migrate/index.mjs`
- Modify: `package.json` (add script)
- Generated: `src/data/db/{firms,funds,assets,deals,participants,stakes}.json`, `docs/migration-report.md`

- [ ] **Step 1: Create the starter overrides file**

The Astound consolidation annotation says "Consolidated into Astound", which creates `asset-astound` — a duplicate of `asset-astound-broadband` (created by deal-052). Merge them:

```json
{
  "assetMerges": {
    "asset-astound": "asset-astound-broadband"
  },
  "parentAssets": {
    "asset-wideopenwest-chicago-area-cable-system": "asset-wideopenwest"
  }
}
```

(`assetMerges`: every reference to the key id is rewritten to the value id and the duplicate record's aliases fold into the survivor. `parentAssets`: sets `parentAssetId` for partial-system assets. Both maps grow as the report surfaces more cases — exact slugs may differ from the above; correct them against the first report run.)

- [ ] **Step 2: Implement the orchestrator**

```js
// scripts/migrate/index.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRegistry, upsertFirm, upsertFund, sponsorFor } from './harvest.mjs'
import { buildDealParticipants } from './participants.mjs'
import { deriveStakes } from './stakes.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const legacy = JSON.parse(readFileSync(join(ROOT, 'src/data/deals.json'), 'utf8'))
const overrides = JSON.parse(readFileSync(join(ROOT, 'scripts/migrate/overrides.json'), 'utf8'))

const reg = createRegistry()

// ── Pass 1: harvest all firms + funds from every pe blob ─────────────────────
for (const d of legacy) {
  for (const party of [d.acquirer, d.acquired]) {
    if (!party?.pe?.firm) continue
    const firms = upsertFirm(reg, party.pe.firm, party.pe)
    for (const fundName of party.pe.primaryFunds ?? []) {
      upsertFund(reg, fundName, [sponsorFor(fundName, firms)])
    }
  }
}

// ── Pass 2: participants + normalized deal records ───────────────────────────
const participants = []
const allFlags = [...reg.flags]
const deals = legacy.map(d => {
  const { rows, flags } = buildDealParticipants(d, reg)
  participants.push(...rows)
  allFlags.push(...flags)
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

// ── Pass 3: apply overrides ──────────────────────────────────────────────────
for (const [fromId, toId] of Object.entries(overrides.assetMerges ?? {})) {
  const fromKey = fromId.replace(/^asset-/, '')
  const toKey = toId.replace(/^asset-/, '')
  const from = reg.assets.get(fromKey)
  const to = reg.assets.get(toKey)
  if (!from || !to) { allFlags.push(`override merge ${fromId} → ${toId}: id not found, skipped`); continue }
  for (const alias of [from.name, ...from.aliases]) {
    if (alias !== to.name && !to.aliases.includes(alias)) to.aliases.push(alias)
  }
  reg.assets.delete(fromKey)
  for (const p of participants) if (p.partyId === fromId) p.partyId = toId
}
for (const [childId, parentId] of Object.entries(overrides.parentAssets ?? {})) {
  const child = reg.assets.get(childId.replace(/^asset-/, ''))
  if (child) child.parentAssetId = parentId
  else allFlags.push(`override parent ${childId}: id not found, skipped`)
}

// ── Pass 4: lineage — successor participants set successorAssetId ────────────
for (const d of deals) {
  const ps = participants.filter(p => p.dealId === d.id)
  const succ = ps.find(p => p.role === 'successor')
  if (!succ) continue
  for (const t of ps.filter(p => p.role === 'target')) {
    const a = reg.assets.get(t.partyId.replace(/^asset-/, ''))
    if (a) a.successorAssetId = succ.partyId
  }
}

// ── Pass 5: stakes ───────────────────────────────────────────────────────────
const { stakes, flags: stakeFlags } = deriveStakes(deals, participants)
allFlags.push(...stakeFlags)

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

const report = [
  '# Migration report', '',
  `Generated from src/data/deals.json (${legacy.length} deals).`, '',
  `| Collection | Count |`, `|---|---|`,
  `| firms | ${reg.firms.size} |`, `| funds | ${reg.funds.size} |`,
  `| assets | ${reg.assets.size} |`, `| participants | ${participants.length} |`,
  `| stakes | ${stakes.length} |`, '',
  `## Flags for review (${allFlags.length})`, '',
  ...allFlags.map(f => `- [ ] ${f}`), '',
].join('\n')
writeFileSync(join(ROOT, 'docs/migration-report.md'), report)

console.log(`Wrote src/data/db/ — firms:${reg.firms.size} funds:${reg.funds.size} assets:${reg.assets.size} participants:${participants.length} stakes:${stakes.length}`)
console.log(`${allFlags.length} flags → docs/migration-report.md`)
```

- [ ] **Step 3: Add npm script**

In `package.json` `"scripts"`, add:

```json
"migrate": "node scripts/migrate/index.mjs"
```

- [ ] **Step 4: Run the migration**

Run: `npm run migrate`
Expected: console summary with counts and a flag total. Non-zero exit or a thrown error = fix before proceeding.

- [ ] **Step 5: Review the report and fix overrides**

Read `docs/migration-report.md` end to end. For each flag, either confirm it is benign or add a correction to `scripts/migrate/overrides.json` (asset merges, parent assignments). Re-run `npm run migrate` after each overrides change until the asset list has no obvious duplicates. The known cases to verify:
- `asset-astound` merged into `asset-astound-broadband` (overrides starter handles this — confirm the slugs match what the report shows)
- WOW partial systems (`Chicago-Area Cable System`, `Illinois, Indiana & Maryland Cable Systems`) exist as separate assets with `parentAssetId` pointing at the WideOpenWest parent

- [ ] **Step 6: Spot-check the temporal core**

Run:
```bash
node -e "
const stakes = require('./src/data/db/stakes.json')
const open = stakes.filter(s => s.endDate === null)
const tpg = open.filter(s => s.ownerId.includes('tpg'))
console.log('TPG open stakes:', tpg.map(s => s.assetId))
const astound = stakes.filter(s => s.assetId.includes('astound'))
console.log('Astound history:', astound.map(s => [s.ownerId, s.startDate, s.endDate]))
"
```
Expected: TPG's open stakes do NOT include Astound; Astound history shows TPG (2021-04 → 2021-08) then Stonepeak (2021-08 → null).

- [ ] **Step 7: Commit generated data**

```bash
git add scripts/migrate/ src/data/db/ docs/migration-report.md package.json
git commit -m "feat: run normalized-model migration — generate db collections + report"
```

---

### Task 7: db.js selector layer

**Files:**
- Create: `src/data/db.js`
- Test: `tests/db.test.js`

- [ ] **Step 1: Write failing tests** (these run against the real generated collections)

```js
// tests/db.test.js
import { describe, it, expect } from 'vitest'
import { db, portfolioOf, fundsOf, evolutionChain, legacyDeals, participantsOf }
  from '../src/data/db.js'

describe('db indexes', () => {
  it('loads all six collections', () => {
    expect(db.firms.length).toBeGreaterThan(10)
    expect(db.deals.length).toBeGreaterThanOrEqual(50)
    expect(db.stakes.length).toBeGreaterThan(10)
  })
})

describe('portfolioOf', () => {
  it('TPG no longer holds Astound', () => {
    const names = portfolioOf('firm-tpg-capital').map(a => a.name)
    expect(names.join('|')).not.toMatch(/astound/i)
  })
  it('Stonepeak holds Astound', () => {
    const names = portfolioOf('firm-stonepeak-infrastructure-partners').map(a => a.name)
    expect(names.join('|')).toMatch(/astound/i)
  })
  it('as-of queries see historical ownership', () => {
    const names = portfolioOf('firm-tpg-capital', '2021-06-01').map(a => a.name)
    expect(names.join('|')).toMatch(/astound/i)
  })
})

describe('legacyDeals', () => {
  it('reconstructs the legacy shape for every deal', () => {
    const all = legacyDeals()
    expect(all.length).toBe(db.deals.length)
    const d = all.find(x => x.id === 'deal-052')
    expect(d.acquirer.name).toBe('Stonepeak Infrastructure Partners')
    expect(d.dealValue).toBe(8100000000)
    expect(d.acquired.pe.firm).toBe('TPG Capital')
    expect(d.acquired.pe.otherTelecomPortfolio.join('|')).not.toMatch(/astound/i)
  })
})

describe('evolutionChain', () => {
  it('walks the Astound lineage back through its predecessors', () => {
    const chain = evolutionChain('asset-astound-broadband')
    expect(chain.length).toBeGreaterThanOrEqual(2)
    expect(chain.some(d => d.dealType === 'Consolidation')).toBe(true)
  })
})

describe('participantsOf', () => {
  it('returns buyer, target, seller for deal-052', () => {
    const roles = participantsOf('deal-052').map(p => p.role).sort()
    expect(roles).toContain('buyer')
    expect(roles).toContain('seller')
    expect(roles).toContain('target')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/db.test.js`
Expected: FAIL — cannot find module `src/data/db.js`

- [ ] **Step 3: Implement db.js**

```js
// src/data/db.js
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
  return openStakes(asOf)
    .filter(s => s.ownerId === ownerId)
    .map(s => db.asset.get(s.assetId))
    .filter(Boolean)
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/db.test.js`
Expected: all PASS. If `firm-tpg-capital` / `firm-stonepeak-infrastructure-partners` ids don't match, check the generated `firms.json` for the real slugs and fix the TEST ids (the generated data is the source of truth for slugs).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all suites pass

- [ ] **Step 6: Commit**

```bash
git add src/data/db.js tests/db.test.js
git commit -m "feat: db.js selector layer with temporal portfolio queries + legacy bridge"
```

---

### Task 8: Bridge App.jsx and port CompanyInfoPage

**Files:**
- Modify: `src/App.jsx:3` (import swap)
- Modify: `src/components/CompanyInfoPage.jsx` (replace `buildPEDirectory`, delete sold-asset workaround)

- [ ] **Step 1: Swap the App.jsx data source**

In `src/App.jsx`, replace line 3:

```js
import staticDeals from './data/deals.json'
```

with:

```js
import { legacyDeals } from './data/db'

const staticDeals = legacyDeals()
```

(Keep the variable name `staticDeals` so the merge at `App.jsx:278` is untouched.)

- [ ] **Step 2: Verify the app renders on all five tabs**

Run the dev server and click through Deal Tracker, Analytics, Fund Mgmt, Companies, Evolutions. Expected: every tab renders without console errors; deal count badge still shows 50.

- [ ] **Step 3: Replace buildPEDirectory in CompanyInfoPage.jsx**

Delete the `baseName` helper, the entire existing `buildPEDirectory(deals)` function, and the sold/bought filtering block inside it (currently `src/components/CompanyInfoPage.jsx:42-131`). Replace with:

```js
import { db, portfolioOf, fundsOf } from '../data/db'

function buildPEDirectory() {
  return db.firms
    .map(firm => {
      const dealRefs = db.participants
        .filter(p => p.partyType === 'firm' && p.partyId === firm.id)
        .map(p => {
          const d = db.deal.get(p.dealId)
          return {
            id: d.id, date: d.date,
            role: p.role === 'seller' ? 'Backed target' : 'Backed acquirer',
            acquirer: d.display.acquirerName, acquired: d.display.acquiredName,
            dealValue: d.valueUSD, dealType: d.dealType, status: d.status,
          }
        })
      return {
        firm: firm.name, firmType: firm.firmType, aum: firm.aum,
        headquarters: firm.headquarters, website: firm.website,
        primaryFunds: fundsOf(firm.id).map(f => f.name),
        otherTelecomPortfolio: portfolioOf(firm.id).map(a => a.name),
        dealRefs,
      }
    })
    .filter(f => f.dealRefs.length > 0)
    .sort((a, b) => a.firm.localeCompare(b.firm))
}
```

Then update the call site in the component (currently `const peDirectory = useMemo(() => buildPEDirectory(deals), [deals])`) to:

```js
const peDirectory = useMemo(() => buildPEDirectory(), [])
```

`PECard` renders unchanged — the returned object has the same field names.

- [ ] **Step 4: Verify in the browser**

On the Companies tab, PE Firms filter: TPG Capital's Telecom Portfolio shows DirecTV (no Astound); Stonepeak's shows Astound; Crestview still shows WideOpenWest. Run `npm test` — all pass.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/components/CompanyInfoPage.jsx
git commit -m "feat: app reads normalized db via legacy bridge; Companies portfolio from live stakes"
```

---

### Task 9: Port Analytics leaderboard to participants

**Files:**
- Modify: `src/components/AnalyticsPage.jsx` (delete `CO_ACQUIRER_SPLITS` at line 27, replace `buildLeaderboard` at line 192, update `openAcquirerDrill`)

- [ ] **Step 1: Delete CO_ACQUIRER_SPLITS and replace buildLeaderboard**

Add the import at the top of the file:

```js
import { db, partyName } from '../data/db'
```

Delete the entire `CO_ACQUIRER_SPLITS` constant. Replace `buildLeaderboard(deals)` with:

```js
const acqTypeOf = p => p.partyType === 'firm'
  ? (db.firm.get(p.partyId)?.firmType ?? 'PE / Infrastructure')
  : (db.asset.get(p.partyId)?.type ?? 'Strategic')

function buildLeaderboard() {
  const map = new Map()
  for (const d of db.deals) {
    if (d.status === 'Terminated') continue
    for (const p of db.participants) {
      if (p.dealId !== d.id || p.role !== 'buyer') continue
      const name = partyName(p)
      if (!map.has(name)) {
        map.set(name, { name, value: 0, count: 0, type: acqTypeOf(p), dealIds: new Set() })
      }
      const e = map.get(name)
      e.count++
      e.value += (d.valueUSD ?? 0) * (p.pct ?? 1)
      e.dealIds.add(d.id)
    }
  }
  return [...map.values()]
    .sort((a, b) => b.value - a.value)
    .slice(0, 12)
    .map(e => ({ ...e, valueB: +(e.value / 1e9).toFixed(2) }))
}
```

Update the component call site from `buildLeaderboard(deals)` to `buildLeaderboard()` and its `useMemo` deps to `[]`.

- [ ] **Step 2: Update the drill-down to use dealIds**

Replace the existing `openAcquirerDrill` (which uses `matchNames`) with:

```js
const openAcquirerDrill = row => {
  const matched = deals
    .filter(d => row.dealIds.has(d.id))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
  setDrilldown({ title: row.name, deals: matched })
}
```

(`deals` here is the legacy-shaped prop — ids are identical across both representations, so the drill-down panel renders unchanged.)

- [ ] **Step 3: Verify in the browser**

Analytics tab → Top Acquirers: no compound rows like "T-Mobile US + KKR"; T-Mobile and KKR appear as separate rows with split capital; clicking a row opens the drill-down with that party's deals. Run `npm test`.

- [ ] **Step 4: Commit**

```bash
git add src/components/AnalyticsPage.jsx
git commit -m "feat: Analytics leaderboard from deal participants — delete CO_ACQUIRER_SPLITS"
```

---

### Task 10: Port Evolutions chain to lineage pointers

**Files:**
- Modify: `src/components/EvolutionsPage.jsx` (replace `buildChain` at line 51 and `getSearchSuggestions` at line 96; remove `excludedPredecessors` state and the pinned/excluded plumbing in the component)

- [ ] **Step 1: Replace the data functions**

Add the import:

```js
import { db, evolutionChain } from '../data/db'
```

Replace `buildChain(query, deals, pinnedPredecessors, excludedPredecessors)` with:

```js
function resolveEntity(query) {
  const q = query.trim().toLowerCase()
  if (!q) return null
  const pool = [...db.assets, ...db.firms]
  return pool.find(e => e.name.toLowerCase() === q)
    ?? pool.find(e => e.name.toLowerCase().includes(q)
      || (e.aliases ?? []).some(a => a.toLowerCase().includes(q)))
    ?? null
}

export function buildChain(query, deals) {
  const entity = resolveEntity(query)
  if (!entity) return { chain: [], predecessors: [] }
  const isFirm = entity.id.startsWith('firm-')
  const dealIds = isFirm
    ? new Set(db.participants.filter(p => p.partyId === entity.id).map(p => p.dealId))
    : new Set(evolutionChain(entity.id).map(d => d.id))
  const chain = deals
    .filter(d => dealIds.has(d.id))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
  const predecessors = isFirm ? [] : db.assets
    .filter(a => a.successorAssetId === entity.id || a.parentAssetId === entity.id)
    .map(a => a.name)
  return { chain, predecessors }
}
```

Replace `getSearchSuggestions(query, deals)` with:

```js
export function getSearchSuggestions(query, deals) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const countFor = id => new Set(
    db.participants.filter(p => p.partyId === id).map(p => p.dealId)).size
  const match = e => e.name.toLowerCase().includes(q)
    || (e.aliases ?? []).some(a => a.toLowerCase().includes(q))
  return [
    ...db.assets.filter(match).map(a => ({ name: a.name, count: countFor(a.id), role: 'ISP platform' })),
    ...db.firms.filter(match).map(f => ({ name: f.name, count: countFor(f.id), role: 'PE firm' })),
  ].filter(s => s.count > 0).slice(0, 8)
}
```

- [ ] **Step 2: Simplify the component**

In the `EvolutionsPage` component: the predecessor pills are now real lineage (from `successorAssetId`/`parentAssetId`), not string guesses — delete the `excludedPredecessors` state, the `pinnedPredecessors` state if present, and the × dismiss handler on pills (render pills as informational tags). Update every `buildChain(...)` call to the new two-argument signature and destructure `{ chain, predecessors }`. `buildChartData` and the card components consume `chain` (legacy-shaped deals) and need no changes.

- [ ] **Step 3: Verify in the browser**

Evolutions tab → search "Astound": chain shows the GFiber merger, the Stonepeak acquisition, the consolidation, and predecessor deals; pills show RCN/WaveDivision/Grande. Trace button from Deal Tracker still lands with a populated chain. Run `npm test`.

- [ ] **Step 4: Commit**

```bash
git add src/components/EvolutionsPage.jsx
git commit -m "feat: Evolutions chain from asset lineage pointers"
```

---

### Task 11: Cleanup and final verification

**Files:**
- Modify: `src/data/deals.js` (delete the data array, keep constants)
- Modify: `docs/migration-report.md` reference note (no code change — verification)

- [ ] **Step 1: Reduce deals.js to constants**

Delete lines 1–1670 of `src/data/deals.js` (`export const deals = [ … ]`). Keep the three constant exports (`ISP_TYPES`, `DEAL_TYPES`, `STATUSES`) — `DealForm.jsx:3` and `FilterBar.jsx:2` import only these.

- [ ] **Step 2: Confirm nothing imports the deleted array**

Run: `grep -rn "from '../data/deals'" src/ && grep -rn "import.*{.*deals.*}.*from.*data/deals" src/`
Expected: only `ISP_TYPES`, `DEAL_TYPES`, `STATUSES` named imports appear.

- [ ] **Step 3: Note the frozen legacy file**

`src/data/deals.json` stays in place — it is the frozen migration input (read by `npm run migrate` and by `api/server.mjs:183` for refresh comparison). Do not edit it for new deals; new deals go into the db collections (manual edit or a future authoring flow).

- [ ] **Step 4: Full verification**

Run: `npm test` — all suites pass.
Run: `npm run build` — completes without errors.
Browser: click through all five tabs; spot-check TPG (Companies), T-Mobile/KKR rows (Analytics), Astound chain (Evolutions), Trace button (Deal Tracker).

- [ ] **Step 5: Commit**

```bash
git add src/data/deals.js
git commit -m "chore: reduce deals.js to UI constants — data now lives in normalized db"
```
