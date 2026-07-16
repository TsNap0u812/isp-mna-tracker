# Data Correctness + Authoring Workflow Plan (Review packages A+B)

> **For agentic workers:** Execute task-by-task with implementer + reviewer subagents. Steps use checkbox syntax.

**Goal:** Fix the seven data-correctness bugs found in review (carve-out collapse, self-owned stakes, >100% sums, halved JV stakes, firm-as-asset, junk funds, lost fund attribution) and make the migration workflow sustainable (additive authoring input, validation, flag lifecycle, override capabilities, local-deal visibility, stale tooling).

**Semantics decision (locked):** `deal.ownershipPct` = total % of the target transferred in the deal. `participants.pct` (buyers) = each buyer's fraction of that transfer. `stake.pct = buyer.pct × ownershipPct` stays; wrong *data* gets fixed via overrides, not a formula change.

**Branch:** `data-correctness-authoring`, merge to main when green.

---

## Task 1 — Simple override capabilities + quick-win entries

New override sections in `scripts/migrate/overrides.json`, support in `scripts/migrate/index.mjs` (+ small harvest hook), TDD where logic is non-trivial:

- `notFunds: ["N/A", ...]` — skip fund harvest for junk names (or regex `/^n\/?a\b/i` in `upsertFund` guard + explicit list). Kills `fund-n-a` (co-sponsored by Cox AND Mediacom), `fund-n-a-family-owned-conglomerate`, `fund-secured-lender-consortium`.
- `dealPatches: { "deal-013": { "ownershipPct": 100 }, "deal-041": { "ownershipPct": 100 } }` — shallow field patches on normalized deal records. GigaPower JV transferred 100% of the greenfield assets (AT&T 50/BlackRock 50); MetroNet JV took full ownership (T-Mobile 50/KKR rollover 50).
- `firmPatches: { "firm-apax-partners": { "firmType": "Private Equity" }, ... }` — post-merge field fills for the 10 null-shell compound-split firms (Apax, Ares, CPPIB, Creditor Consortium, DigitalBridge Group, Elliott, Madison Dearborn, Pamlico, Warburg Pincus, Catania). firmType minimum; aum/hq where derivable from legacy blob text.
- `buyerOverrides` additions (mechanism exists):
  - `deal-004`: Searchlight Capital pct 1 (kills Consolidated-owns-itself)
  - `deal-012`: KKR 0.5 + Ares 0.5 (kills MetroNet-owns-itself; flag "recap split assumed equal")
  - `deal-034`: EQT 0.5 + firm-digitalbridge-group 0.5 (kills asset-digital-colony-partners)
  - `deal-039`: T-Mobile US pct 1 (EQT was the SELLER side — it retained, not bought; its stake reduction is Task 2)

Run migrate; assert: no self-owned stakes (ownerId === assetId), no N/A funds, GigaPower stakes 50/50, digital-colony asset gone.

## Task 2 — stakeOverrides (patch + add) for partial-deal residuals

`stakeOverrides` in overrides.json, applied in index.mjs AFTER deriveStakes:
- `{ "action": "patch", "match": { "assetId", "ownerId", "openedByDealId" }, "set": { pct/endDate/closedByDealId } }`
- `{ "action": "add", ...full stake fields }` (ids assigned after existing sequence)
Unknown match → flag, not crash.

Entries:
- **Lumos**: patch EQT stake (openedBy deal-031) → endDate 2025-04-01, closedBy deal-039; add EQT 50% stake from 2025-04-01 openedBy deal-039. Result: T-Mobile 50 + EQT 50, no 150%.
- **MetroNet**: KKR/Ares deal-012 stakes close at deal-041 (2025-07-24) — check whether deriveStakes already closes them once deal-041 ownPct=100 (Task 1); patch only if needed. Result: T-Mobile 50 + KKR 50.
- **DirecTV**: add AT&T pre-history stake (pct 100, start null, end 2021-08-02, closedBy deal-033); add AT&T 70% stake 2021-08-02→2025-07-02 (openedBy deal-033, closedBy deal-023). TPG's existing 30 + 70 layered stakes stay.
- **Boost**: add T-Mobile pre-history stake (pct 100, start null, end 2020-07-01, closedBy deal-035).

Invariant test (permanent, in tests/): for every asset, sum of open stake pcts ≤ 100 (+ epsilon); and at asOf sample dates. Run migrate; verify.

## Task 3 — Carve-out asset splits

New override sections: `newAssets: [{ id, name, type, ticker, parentAssetId }]` injected into the registry pre-pass-3, and `targetOverrides: { dealId: [assetId, ...] }` replacing that deal's target participant rows (mirror of buyerOverrides; unknown ids flagged).

Children (parent set via parentAssetId):
- `asset-lumen-ilec-20-states` (parent asset-lumen-technologies) ← deal-003 target
- `asset-lumen-mass-markets` (parent asset-lumen-technologies) ← deal-037 target
- `asset-frontier-pnw-ilec` (parent asset-frontier-communications) ← deal-005 target
- `asset-fastwyre-nebraska`, `asset-fastwyre-louisiana-texas-alabama`, `asset-fastwyre-missouri` (parent asset-fastwyre-broadband) ← deals 043/047/048 targets

Expected after migrate: Brightspeed owns the ILEC child (not all of Lumen); AT&T owns mass-markets child; no fictitious Brightspeed→AT&T transfer; Ziply owns the PNW child (Verizon/Frontier deal-011 no longer closes Ziply's stake); Fastwyre parent no longer flips owner per regional deal; MDP/Catania pre-history stakes land on children. Evolutions chains still work (children join lineage via parentAssetId).

## Task 4 — Per-deal fund attribution (fundIds)

- `participants.mjs`: firm rows (buyer/backer/seller) get `fundIds: []` resolved from that party's `pe.primaryFunds` via the fund registry (same key derivation as harvest). Replace the always-null `fundId` field with `fundIds` (grep first: nothing consumes fundId).
- `db.js legacyDeals()`: `primaryFunds` from the participant row's fundIds (names via db.fund), falling back to `fundsOf(firm)` when empty.
- Test: deal-032 (TPG 2021) shows Funds VIII/IX not X/XI; deal-022 (TPG 2024) shows X/XI.

## Task 5 — Authoring path + flag lifecycle + stale tooling

- `src/data/new-deals.json` (create as `[]`) — additive input concatenated with the frozen legacy file in index.mjs. Authoring shape = legacy deal minus `pe.otherTelecomPortfolio` (ignored anyway).
- Input validation before pass 1: duplicate ids (across both files), missing id/date/status/acquirer.name/acquired.name, unknown status/dealType vocabulary → hard error listing offenders.
- `acknowledgedFlags: []` in overrides.json; report renders **NEW flags first** under their own heading, acknowledged ones collapsed below; console prints new-flag count. Seed acknowledgedFlags with the currently-triaged benign flags.
- Update `src/data/deals.js` header comment + plan-doc reference to name new-deals.json as the authoring path.
- Delete `scripts/refresh-data.mjs` + `refresh-data` npm script (its guidance points at a file that no longer holds data; `api/server.mjs` /api/refresh supersedes it).
- `api/server.mjs` `getExistingNames()` reads db `assets.json` + `firms.json` names AND aliases instead of the frozen legacy file.

## Task 6 — Local-deal visibility + final verification

Surgical overlay (no context refactor):
- `AnalyticsPage.buildLeaderboard(deals)`: after the db aggregation, fold in prop deals whose id is NOT in db.deal (i.e. local ones): acquirer name as single buyer, pct 1, type via existing `acqType(deal)`.
- `CompanyInfoPage.buildPEDirectory(deals)`: append dealRefs (+ create a card if new) for local deals with `pe` blobs, matched by firm name against db firm names/aliases, else new card from the blob.
- `EvolutionsPage.buildChain`: after the entity path, also include local deals (id not in db.deal) whose acquirer/acquired name contains the resolved entity name or an alias.
- Memo deps update from `[]` to `[deals]` where builders now take the prop.
- Final: full test suite green, `npm run build`, `npm run migrate` idempotent (run twice, no diff), browser spot-check (Companies TPG card, Analytics leaderboard, Evolutions Astound + Lumen chains), THEN merge to main.
