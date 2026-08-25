# Fund Data Sources Expansion Plan

**Goal:** Add LP-disclosure sources (CalSTRS/WSIB + generic ingest), manual fund-size patches with citations, actual called-capital-based dry powder, and a visual "structurally invisible" treatment for permanent-capital firms (Cox, Mediacom, Fidelity, Wren House).

**Grounding facts:**
- `scripts/fund-data-query.mjs` (932 lines) fetches SEC EDGAR Form D, SEC IAPD (Form ADV firm-level AUM + privateFundCount), and auto-scrapes the CalPERS PE performance HTML table (Fund, Vintage, Committed, Called, Distributions, NAV, TVPI, DPI, IRR). It REGENERATES `src/data/fund-data.json` wholesale — manual data must live in merged input files, not in fund-data.json.
- `FundMgmtPage.buildFundRows` ignores CalPERS `called` — deployment is always the `estDeployedPct(vintage)` age curve. Committed comes from Form D `totalAmountSold` first.
- Structurally invisible firms (verified): Wren House (sovereign single-LP, evergreen), Cox + Mediacom (family/balance-sheet, "N/A" pseudo-funds), Fidelity Strategic Investments (balance-sheet).

**Branch:** `fund-data-sources`.

## Task 1 — Manual overrides input + capitalType (query script)

- New input file `scripts/fund-overrides.json`: `{ "firms": { "<firmRaw>": { "capitalType": "fund|evergreen|balance-sheet", "capitalNote": "...", "announcedFunds": [{ "fundName", "sizeUSD", "announcedDate", "sourceUrl", "note" }] } } }`
- fund-data-query.mjs merges it into each firm entry (`capitalType` default 'fund', `capitalNote`, `announcedFunds`) during output assembly; unknown firmRaw keys → console warning.
- Seed entries: Wren House evergreen (KIA sovereign capital note), Cox + Mediacom balance-sheet (family-owned note), Fidelity balance-sheet. announcedFunds seeded ONLY with web-verified sizes + source URLs (implementer verifies via search; skip if unverifiable — never fabricate).
- Regenerate fund-data.json (use `npm run fund-data`; if network-blocked, apply the merge offline via a one-off node script against the existing JSON — the merge must be reproducible either way).

## Task 2 — LP disclosure ingest (CalSTRS / WSIB / generic)

- `scripts/lp-data/` directory: any `*.csv` with header `source,fundName,vintage,committedM,calledM,distributedM,navM,irr,asOf,sourceUrl` is ingested by fund-data-query.mjs and matched to firms/funds with the same matching rules as CalPERS (`calpersMatchesFund` style), landing as `firm.lpDisclosures: [...]`.
- Attempt a CalSTRS auto-scrape (their PE portfolio performance page) following the CalPERS scraper pattern; if the source is PDF-only/unfetchable, fall back to creating `scripts/lp-data/README.md` + template CSVs (`calstrs.csv`, `wsib.csv` with header row only) and register both in `lpPortalRefs` with `autoScraped: false`.
- Only real fetched data or empty templates — no fabricated rows.

## Task 3 — FundMgmtPage: real dry powder + invisible-capital treatment

- Committed precedence: `lpDisclosures.committedM` (max across sources) → CalPERS `committed` → Form D `totalAmountSold` → `announcedFunds.sizeUSD` (flag `isAnnounced`).
- Deployment: when any source provides called capital (CalPERS `called` or lpDisclosures `calledM`), use it — `deployedPct = called/committed`, metrics labeled actual (drop the `est.` marker for those); else keep the vintage curve.
- Firms with `capitalType !== 'fund'`: render a distinct card variant — badge "Permanent capital", the capitalNote explanation ("Family-owned — no external funds; not in fundraising disclosures"), NO dry-powder/committed metric grid, no "N/A" fund name anywhere. KPI header totals exclude them.
- Tests: extend/add vitest coverage for the new committed/deployed precedence (extract the pure calc into a testable helper if buildFundRows is too entangled) and for capitalType card data.

## Task 4 — Verify + docs + merge

- Full suite green, build clean, browser spot-check Fund Mgmt tab (Cox/Mediacom show the permanent-capital card; a CalPERS-matched fund shows actual deployment).
- WIKI: one line for scripts/fund-overrides.json + scripts/lp-data/ ingest.
- Merge to main.
