# ISP M&A Tracker — Project Wiki

> **Last updated:** 2026-05-25  
> **Repo:** `TsNap0u812/isp-mna-tracker` · branch `main`  
> **Runtime:** React 18 + Vite 5 + Tailwind CSS SPA · Node.js API server (port 3001)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [File Structure](#4-file-structure)
5. [Data Layer](#5-data-layer)
   - [Deal Schema](#51-deal-schema)
   - [Static Deals (`deals.js`)](#52-static-deals-dealsjs)
   - [User-Added Deals (`useLocalDeals`)](#53-user-added-deals-uselocaldeals)
   - [Merged `allDeals` Array](#54-merged-alldeals-array)
6. [API & Feeds (`api/server.mjs`)](#6-api--feeds-apiserverms)
7. [Component Inventory](#7-component-inventory)
8. [Tab: Deal Tracker](#8-tab-deal-tracker)
9. [Tab: Analytics](#9-tab-analytics)
10. [Tab: Company Info](#10-tab-company-info)
11. [Build History & Changelog](#11-build-history--changelog)
12. [Known Limitations](#12-known-limitations)
13. [Future Roadmap](#13-future-roadmap)

---

## 1. Project Overview

A single-page application for tracking ISP, broadband, cable, and wireless M&A activity in the United States. The tracker provides:

- A curated, searchable/filterable **deal table** covering fiber, cable (MSO), wireless (MNO), satellite, and PE-backed transactions
- An **analytics dashboard** with charts, KPI cards, and drill-through deal panels
- A **company directory** for PE firms and ISP operators involved in tracked deals
- A **live data refresh** feed that scans trade-press RSS and SEC EDGAR filings for new deal signals
- A **deal submission form** for adding deals not yet in the static dataset (persisted to `localStorage`)

---

## 2. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | React 18.3 | Functional components, hooks only |
| Build tool | Vite 5.4 | Dev server with `/api` proxy to port 3001 |
| Styling | Tailwind CSS 3.4 + CSS custom properties | Tristellium design system; `brand-*` → Space Blue; new components use inline styles + CSS vars |
| Icons | lucide-react 0.441 | Tree-shakeable SVG icons |
| Charts | Recharts 3.8 | `ComposedChart`, `BarChart`, `Bar`, `Line`, `Cell` |
| API server | Node.js (ESM) | Vanilla `node:http` — no Express dependency |
| Persistence | `localStorage` | User-added deals only; static deals are in source |
| State | React `useState` / `useMemo` | No external state library |
| Linting/types | Vite defaults | No separate ESLint config; `@types/react` for IDE support |

### Dev scripts (`package.json`)

```bash
npm run dev          # Vite UI (port 5173) + API server (port 3001) via concurrently
npm run build        # Vite production build → dist/
npm run preview      # Serve dist/ locally
npm run api          # API server only
npm run migrate      # Rebuild src/data/db/ from deals.json + new-deals.json + overrides
```

---

## 3. Architecture

```
Browser
│
├── React SPA (Vite, port 5173 in dev)
│   │
│   ├── App.jsx  ← root; 232px sidebar shell + toolbar; owns allDeals, activeTab, selectedId, filters, sort
│   │   │
│   │   ├── [Sidebar] logo · nav tabs · Quick Filters (colored dots) · deal count footer
│   │   │
│   │   ├── [Tab: Deal Tracker]
│   │   │   ├── FilterBar       — search + type/dealType/status/PE filters (inline-styled)
│   │   │   ├── DealTable       — CSS grid (no <table>), sortable, copper selected row
│   │   │   └── DealDetailPanel — 460px slide-in right panel, full deal detail + PE block
│   │   │
│   │   ├── [Tab: Analytics]
│   │   │   └── AnalyticsPage   — KPI cards + 5 Recharts + terminated table
│   │   │                         onNavigateToDeal → switches tab + opens panel
│   │   │
│   │   └── [Tab: Company Info]
│   │       └── CompanyInfoPage — PE firm directory + ISP type filter cards
│   │
│   ├── RefreshModal  — overlay showing live-feed results from /api/refresh
│   └── DealForm      — add-deal modal (form → useLocalDeals → allDeals)
│
├── Data
│   ├── src/data/db/            — normalized collections (firms, funds, assets, deals, participants, stakes)
│   ├── src/data/deals.json     — frozen legacy snapshot (migration input; do not edit)
│   ├── src/data/new-deals.json — additive authoring input (npm run migrate rebuilds db/)
│   └── localStorage            — user-added deals (key: "isp-mna-user-deals")
│
└── API Server (Node.js, port 3001)
    └── GET /api/refresh        — RSS + SEC EDGAR fetch, filter, dedup, annotate
    └── GET /api/health         — liveness check
```

### Data flow: how `allDeals` stays reactive

```
useLocalDeals (localStorage)
  └─ localDeals state
        │
        └─ allDeals = useMemo([...localDeals, ...staticDeals], [localDeals])
              │
              ├─ <DealTable deals={filtered} />          (filtered subset)
              ├─ <AnalyticsPage deals={allDeals} />       (full set)
              └─ <CompanyInfoPage deals={allDeals} />     (full set)
```

Any deal added via `DealForm` flows: `addDeal()` → `localStorage.setItem` → `setLocalDeals` → `allDeals` recomputes → all three tabs re-render with fresh data.

---

## 4. File Structure

```
/
├── api/
│   └── server.mjs              API server — RSS/SEC refresh endpoint
├── src/
│   ├── App.jsx                 Root component; tab nav, filter state, deal merge
│   ├── main.jsx                React root mount
│   ├── index.css               Tailwind directives + any global overrides
│   ├── components/
│   │   ├── AnalyticsPage.jsx   Analytics tab — KPI cards, Recharts, drill-through
│   │   ├── CompanyInfoPage.jsx Company Info tab — PE + ISP type directories
│   │   ├── DealDetailPanel.jsx Right-side slide panel with full deal detail
│   │   ├── DealForm.jsx        Add-deal modal form
│   │   ├── DealTable.jsx       Main deal list table (sortable columns)
│   │   ├── FilterBar.jsx       Search + multi-filter bar above table
│   │   └── RefreshModal.jsx    Live-feed overlay from /api/refresh
│   ├── data/
│   │   ├── db/                 Normalized collections generated by npm run migrate
│   │   ├── db.js               Selector layer (portfolioOf, evolutionChain, legacyDeals)
│   │   ├── deals.json          Frozen legacy snapshot — migration input, do not edit
│   │   ├── new-deals.json      Additive authoring input for new deals
│   │   └── deals.js            UI vocabulary constants only
│   └── hooks/
│       └── useLocalDeals.js    localStorage CRUD for user-added deals
├── scripts/
│   ├── migrate/                Migration pipeline (index.mjs + overrides.json)
│   └── fund-data-query.mjs     SEC Form D / CalPERS fund enrichment fetch
├── package.json
├── vite.config.js
├── tailwind.config.js
├── WIKI.md                     ← this file
└── dist/                       Production build output (gitignored)
```

---

## 5. Data Layer

### 5.1 Deal Schema

Every deal object (static or user-added) follows this shape:

```js
{
  id:        String,          // "deal-001" … "deal-051" (static); "user-{timestamp}" (local)
  date:      String,          // ISO date "YYYY-MM-DD"
                              //   Completed/Completing → close date
                              //   All others          → announce date
  status:    String,          // see Status Enum below
  dealType:  String,          // see Deal Type Enum below

  acquirer: {
    name:    String,
    type:    String,          // see ISP Type Enum below
    ticker:  String | null,
    pe:      PEObject | null, // present if PE/infra-backed
  },

  acquired: {
    name:        String,
    type:        String,
    ticker:      String | null,
    pe:          PEObject | null,
    subscribers: Number | null,   // target's subscriber count at time of deal
    geography:   String[],        // array of 2-letter US state codes
  },

  dealValue:          Number | null,  // USD; null = undisclosed
  ownershipPct:       Number | null,  // percent stake being acquired
  geography:          String[],       // deal-level geography (may duplicate acquired.geography)
  subscribers:        Number | null,  // deal-level subscriber count
  reason:             String,         // 1-2 sentence strategic rationale
  strategicImportance: String,        // longer context
  keyTerms:           String,         // financial terms, closing conditions
  notes:              String,         // analyst notes, corrections log
  userAdded:          Boolean,        // true only on localStorage deals
}
```

**PE Object shape:**
```js
{
  firm:                 String,    // e.g. "Stonepeak Infrastructure Partners"
  firmType:             String,    // e.g. "Infrastructure Fund", "Private Equity"
  aum:                  String,    // e.g. "$65B+"
  primaryFunds:         String[],  // named fund vehicles
  otherTelecomPortfolio: String[], // other known telecom/broadband holdings
  headquarters:         String,
  website:              String,
}
```

**Status Enum:**

| Value | Meaning | UI Color |
|---|---|---|
| `Completed` | Deal closed | Green |
| `Completing` | Closing imminent (regulatory cleared, awaiting final steps) | Teal |
| `Pending / Regulatory Review` | Signed, under FCC / DOJ / state review | Amber |
| `Rumored / In Discussions` | Unconfirmed or pre-signing | Purple |
| `Terminated` | Deal withdrawn, broken, or abandoned | Red |

**Deal Type Enum:**
`Full Acquisition`, `Minority Stake`, `Asset Acquisition`, `Joint Venture`, `Merger of Equals`, `Take-Private`, `Recapitalization`

**ISP Type Enum (selected):**
`MSO`, `MSO / DBS`, `MNO`, `MNO / ILEC`, `Pure MNO`, `ILEC / Fiber`, `ILEC / DSL`, `CLEC / Fiber`, `Pure Fiber (FTTH)`, `Fixed Wireless`, `Fiber Infrastructure REIT`, `Enterprise Fiber / Carrier`, `Fiber ISP (MDU/HOA)`, `DBS`, `Satellite Broadband`

### 5.2 Static Deals (`deals.json`)

- **49 deals** as of 2026-05-25 · ~100 KB of pure JSON
- Deal IDs `deal-001` through `deal-051` (non-sequential gaps exist where deals were merged or removed)
- Spans approximately 2020–2026
- Imported in `App.jsx` as `import staticDeals from './data/deals.json'` (Vite handles JSON imports natively)
- The API server (`api/server.mjs`) also reads `deals.json` directly via `fs.readFileSync` for the deduplication name-list used in `/api/refresh`
- **Database-ready:** the file is a plain JSON array — no JS syntax, no comments. Each element maps 1:1 to the deal schema in §5.1 and can be seeded directly into Postgres (`COPY`), MongoDB (`insertMany`), Supabase (`upsert`), etc.

> `deals.js` (the previous ES-module source file) is superseded by `deals.json` and can be deleted once confirmed stable.

### 5.3 User-Added Deals (`useLocalDeals`)

- **localStorage key:** `isp-mna-user-deals`
- Added via the `DealForm` modal (triggered from `RefreshModal` or directly)
- IDs are `user-{Date.now()}`
- `userAdded: true` flag allows future UI differentiation
- The hook exposes `{ localDeals, addDeal, removeDeal }`

### 5.4 Merged `allDeals` Array

In `App.jsx`:
```js
const allDeals = useMemo(() => [...localDeals, ...staticDeals], [localDeals])
```
User-added deals prepend, so they appear at the top of their date group when sorted descending by date. This array is passed to all three tabs.

---

## 6. API & Feeds (`api/server.mjs`)

### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/refresh` | Scan news sources for ISP M&A signals |
| `GET` | `/api/health` | Liveness check → `{ ok: true }` |

### `/api/refresh` — Response Shape

```json
{
  "items": [ NewsItem ],      // up to 40 items, new deals first
  "source": "RSS + SEC EDGAR" | "NewsAPI",
  "hasApiKey": false,
  "fetchedAt": "2026-05-22T..."
}
```

```json
// NewsItem
{
  "title":          "Charter Acquires Cox for $34.5B",
  "link":           "https://...",
  "description":    "...",
  "pubDate":        "2024-12-19T...",
  "sourceName":     "Telecompetitor",
  "alreadyTracked": true   // true if any word in title matches a known deal party
}
```

### RSS Feed Sources

| Source | Priority | Feed URL |
|---|---|---|
| Telecompetitor | High | `telecompetitor.com/feed/` |
| Telecom Ramblings | High | `telecomramblings.com/feed/` |
| Fierce Network | High | `fierce-network.com/rss/xml` |
| Broadband Breakfast | Medium | `broadbandbreakfast.com/feed/` |
| Light Reading | Medium | `lightreading.com/rss.xml` |
| NTIA BroadbandUSA | Medium | `broadbandusa.ntia.gov/rss.xml` |
| Next TV | Lower | `nexttv.com/rss` |

### SEC EDGAR Sources (Atom)

| Filing Type | Description |
|---|---|
| S-4 | Registration statement for securities issued in mergers — strong leading indicator |
| 8-K Items 1.01 / 2.01 | Material definitive agreements and completed acquisitions |

### Filtering Logic

An RSS item is included if it matches **both**:
- `ISP_RE` — broadband, fiber, cable, MSO, MNO, ILEC, CLEC, ISP, FWA, FTTH, etc.
- `MA_RE` — acqui*, merger, buyout, take-private, joint venture, PE-backed, etc.

A SEC EDGAR item is included if it matches:
- `TELECOM_COS_RE` — known company names list (Charter, Comcast, Verizon, etc.)
- For 8-K: also requires `item 1.01` or `item 2.01` in text

### Optional: `NEWS_API_KEY` Environment Variable

Set `NEWS_API_KEY=<key>` (from newsapi.org) to use the NewsAPI endpoint instead of RSS/SEC scraping. Runs 4 M&A-focused queries against the past 6 months of English-language news.

---

## 7. Component Inventory

| Component | File | Purpose |
|---|---|---|
| `App` | `App.jsx` | Root; owns all shared state; renders tab nav and tab content |
| `FilterBar` | `FilterBar.jsx` | Search input + ISP Type / Deal Type / Status dropdowns + PE-only toggle |
| `DealTable` | `DealTable.jsx` | Sortable deal rows; status badges; date icons (clock/X for non-closed) |
| `DealDetailPanel` | `DealDetailPanel.jsx` | Right-side slide panel; full deal fields + geography + PE info |
| `RefreshModal` | `RefreshModal.jsx` | Overlay for live-feed results; "Create Deal" button pre-fills form |
| `DealForm` | `DealForm.jsx` | Add-deal form modal; saves to localStorage via `addDeal` |
| `AnalyticsPage` | `AnalyticsPage.jsx` | 5 KPI cards + 4 Recharts + terminated table; drill-through panel |
| `CompanyInfoPage` | `CompanyInfoPage.jsx` | PE firm directory + MSO / MNO / Fiber / Satellite company cards |

### Key Icon Conventions (lucide-react)

| Icon | Usage |
|---|---|
| `Wifi` | App header logo |
| `RefreshCw` | Refresh Data button (spins during load) |
| `Clock` | Announced-date indicator on pending/rumored deals |
| `XCircle` | Date indicator on terminated deals |
| `Building2` | Company Info empty state |
| `MapPin` | HQ location in PE cards |
| `Globe` | Website link in PE cards |
| `ExternalLink` | External links + drill-through row hint |
| `X` | Close buttons (modals, panels) |

---

## 8. Tab: Deal Tracker

The default tab. Shows the full `allDeals` list filtered by `filters` state and sorted by `sort` state.

### Filter fields (`DEFAULT_FILTERS`)

```js
{ search: '', ispType: 'All Types', dealType: 'All Deal Types', status: 'All Statuses', peOnly: false }
```

- **search** — free text against acquirer name, acquired name, PE firm name, reason, notes
- **ispType** — matches `acquirer.type` or `acquired.type` exactly
- **dealType** — matches `deal.dealType` exactly
- **status** — matches `deal.status` exactly
- **peOnly** — filters to deals where `acquirer.pe` or `acquired.pe` is set

### Sort

Default: `{ col: 'date', dir: 'desc' }`. Supports nested dot-path columns (e.g. `acquirer.name`).

### Selected deal

`selectedId` state: when set, `DealDetailPanel` renders alongside the table. Set from `Analytics → onNavigateToDeal` callback, which also switches `activeTab` to `'tracker'`.

---

## 9. Tab: Analytics

Built with **Recharts 3.8**. All chart data is derived from `allDeals` via `useMemo` hooks — updates automatically when deals are added.

### KPI Cards (top row)

| Card | Metric | Delta |
|---|---|---|
| TTM Deal Count | `count(deals, last 365 days, excl. terminated)` | vs prior 365 days |
| TTM Deal Value | `sum(dealValue, last 365 days)` | vs prior 365 days |
| Pipeline Value | `sum(dealValue, status in [Pending, Rumored, Completing])` | — |
| PE / Infra Share (TTM) | `sum(TTM PE-backed deals) / sum(TTM all deals)` | — |
| Subscribers in TTM Deals | `sum(acquired.subscribers, TTM deals)` | — |

### Charts

| Chart | Type | Click behavior |
|---|---|---|
| Quarterly Deal Activity by Acquirer Type | `ComposedChart` stacked bar ($B) + count line | Click quarter → drill panel |
| Deal Pipeline | Custom CSS funnel (3 stages) | — |
| Top Acquirers by Deal Value | Horizontal `BarChart`, colored by type | Click row → drill panel |
| Deal Size Distribution | Custom CSS bars by tier | — |
| PE & Infrastructure Platform Activity | Horizontal stacked `BarChart` | Click firm → drill panel |
| Wireline–Wireless Convergence | Stacked `BarChart` by quarter | Click quarter → drill panel |
| Terminated Deals | HTML table | Click row → navigate to deal |

### Drill-Through Panel

Clicking a chart bar opens a side panel listing the underlying deals. Each deal row shows `acquirer → target`, date, value, and status badge. Clicking a deal calls `onNavigateToDeal(id)` (prop from `App.jsx`), which:
1. Sets `activeTab = 'tracker'`
2. Sets `selectedId = id`
3. `DealDetailPanel` opens automatically on the tracker tab

### Acquirer Type Classification (`acqType` function)

| Priority | Condition | Label |
|---|---|---|
| 1 | `acquirer.pe` set + firmType contains "infrastructure/infra" | Infrastructure Fund |
| 2 | `acquirer.pe` set (other) | Private Equity |
| 3 | `acquirer.type` starts with `MNO` | Wireless Carrier |
| 4 | `acquirer.type` starts with `MSO` | Cable MSO |
| 5 | ILEC / CLEC / Pure Fiber / Fixed Wireless / Fiber variants | Fiber / ILEC |
| 6 | Satellite / DBS | Satellite |
| 7 | Fallback | Other |

### Convergence Flag

A deal is flagged as **wireline–wireless convergence** if one party is `MNO` (mobile) and the other is wireline (MSO / ILEC / CLEC / Pure Fiber / Fiber). Drives the Convergence Tracker chart.

---

## 10. Tab: Company Info

Filterable directory of companies extracted from the deals dataset.

### Filter Tabs

| Tab | Source logic |
|---|---|
| **PE Firms** (default) | `buildPEDirectory(deals)` — all unique `pe.firm` values across acquirer and acquired |
| **Cable (MSO)** | `acquirer.type` or `acquired.type` starts with `MSO` |
| **Wireless (MNO)** | starts with `MNO` |
| **Fiber / ILEC** | starts with `ILEC` or `CLEC`, or equals `Pure Fiber (FTTH)`, `Fixed Wireless`, `Fiber Infrastructure REIT`, `Enterprise Fiber / Carrier`, `Fiber ISP (MDU/HOA)` |
| **Satellite** | contains `Satellite` or starts with `DBS` |

> **Note on `startsWith` vs `includes`:** The matchers deliberately use `startsWith('ILEC')` (not `includes`) to prevent `MNO / ILEC` types (AT&T, Verizon) from appearing in the Fiber category.

### PE Directory Builder (`buildPEDirectory`)

- Keyed on `pe.firm` string
- Merges richest field values across multiple deal appearances (longest funds/portfolio arrays, first non-null AUM/HQ/website)
- Accumulates `dealRefs` with role `"Backed acquirer"` or `"Backed target"`
- Sorted A–Z by firm name

### PE Card Fields

HQ, website (with external link), primary fund vehicles (gray chips), telecom portfolio companies (indigo chips), tracked deals with role badge + date + acquirer→target + value + status.

---

## 11. Build History & Changelog

### Phase 1–5 (Pre-session baseline)
Core deal tracker with static `deals.js`, filter bar, sortable table, deal detail panel, RSS/SEC refresh modal, and `DealForm` for user-added deals.

### Phase 6 — Data Refresh & Terminated Status
- Added `Terminated` status to the status enum, `STATUS_BADGE` maps, `DealTable` date column (red `XCircle` icon), and `DealDetailPanel` status pill
- Corrected 7 existing deals (status, date, value, geography):
  - `deal-022` DirecTV/DISH → `Terminated` (bondholder vote failure Nov 2024)
  - `deal-023` TPG/DirecTV 70% → `Completed`, date `2025-07-02`
  - `deal-024` Uniti/Windstream → `Completed`, date `2025-08-01`, terms updated
  - `deal-011` Verizon/Frontier → `Completed`, date `2026-01-20`
  - `deal-010` T-Mobile/US Cellular → `Completed`, date `2025-08-01`, value $4.3B
  - `deal-021` Charter/Cox → value $34.5B, notes updated (FCC approved Mar 2026)
  - `deal-037` AT&T/Lumen → `Completed`, date `2026-02-02`, value $5.75B, 11-state geography
- Added 7 new deals (`deal-045` through `deal-051`):
  - BCE + Ziply Fiber (Aug 2025, Completed, ~$3.65B USD)
  - Brightspeed + Cincinnati Communications (Jul 2025, Completed)
  - WOW! take-private by DigitalBridge + Crestview (Dec 2025, Completed, $1.5B EV)
  - Swyft Fiber + Fastwyre LA/TX/AL (Dec 2025, Pending, Macquarie-backed)
  - Socket Fiber + Fastwyre Missouri (Apr 2026, Completed, Oak Hill + Pamlico)
  - Cable One/Sparklight + MBI/Vyve 55% (Jan 2026, Pending, $485M)
  - GFiber (Alphabet) + Astound merger (Mar 2026, Pending, ~7.1M locations)
- **Total deals: 49**

### Phase 7 — Tab Navigation
- Added 3-tab nav bar below the main header: Deal Tracker · Analytics · Company Info
- `activeTab` state in `App.jsx`; Refresh Data button and deal count only shown on tracker tab
- Placeholder `AnalyticsPage` and `CompanyInfoPage` components created

### Phase 8 — Company Info Page
- Full PE firm directory using all `pe` objects from `deals.js`
- Type filter pills: PE Firms (default), Cable (MSO), Wireless (MNO), Fiber/ILEC, Satellite
- Live search scoped to active filter; count badges on each pill
- `PECard`: firm header (dark brand), HQ, website, fund chips, portfolio chips, tracked deals
- `CompanyCard`: name, ticker, type badge, deal history list

### Phase 9 — Analytics Page
- Installed **Recharts 3.8** (`npm install recharts`)
- 5 KPI cards (TTM deal count, TTM value, pipeline value, PE share, TTM subscribers)
- Charts: quarterly activity, pipeline funnel (CSS), acquirer leaderboard, size distribution (CSS), PE platform, convergence tracker, terminated deals table
- All chart data wrapped in `useMemo([deals])` — fully reactive to deal additions

### Phase 11 — Deals Data Migrated to JSON *(latest)*
- `src/data/deals.js` (ES module with JS comments) converted to `src/data/deals.json` (pure JSON array, ~100 KB)
- `App.jsx` import updated: `import staticDeals from './data/deals.json'`
- `api/server.mjs` deduplication updated: now parses JSON directly instead of regex-scanning JS source text (cleaner and more accurate name extraction)
- `deals.json` is now database-ready — can be seeded into Postgres, MongoDB, Supabase, etc. without any transformation

### Phase 10 — Analytics Drill-Through Links
- `DrilldownPanel` component: fixed right-side panel with backdrop, shows deals for clicked chart segment
- 4 charts now clickable: Quarterly Activity, Acquirer Leaderboard, PE Platform, Convergence Tracker
- Terminated Deals table rows are directly clickable (no panel needed — single deal per row)
- `onNavigateToDeal(id)` callback prop: `AnalyticsPage` → `App.jsx` → sets `activeTab='tracker'` + `selectedId=id` → `DealDetailPanel` auto-opens
- Tooltip on quarterly chart now shows "Click bar to view deals" hint

### Phase 12 — Apple-Inspired Visual Redesign (Tristellium Design System) *(latest)*

Full UI overhaul driven by a Claude Design bundle (`KXf-dSfFbVesOganbEWUJw`). The app visual language was completely replaced with an Apple-inspired design using the Tristellium color palette.

#### Design Tokens (`index.css` + `tailwind.config.js`)
- **Font:** Inter Variable (`rsms.me/inter`) with `font-feature-settings: "ss01","cv11","cv05"` and `-0.005em` letter-spacing for optical refinement
- **Tristellium palette** as CSS custom properties:

| Token | Value | Role |
|---|---|---|
| `--space-blue` | `#2d3068` | Sidebar, primary nav background |
| `--space-blue-hover` | `#3a3e7d` | Sidebar hover states |
| `--space-blue-deep` | `#1f2148` | Sidebar gradient endpoint |
| `--copper` | `#955438` | Logo accent, active state indicators |
| `--copper-mid` | `#B8744F` | Buttons, gradient midpoint |
| `--copper-light` | `#E8B194` | Quick filter: In Review |
| `--copper-soft` | `#fbeee5` | Selected row background |
| `--teal` | `#009d8c` | Quick filter: Completed |
| `--teal-bright` | `#00DEC8` | iOS toggle active state, date dots |
| `--teal-soft` | `#d6f8f4` | Teal chip backgrounds |
| `--violet` | `#5872E0` | Quick filter: Rumored, PE badges |
| `--violet-deep` | `#3f56c0` | Violet hover states |
| `--violet-soft` | `#e6eafe` | PE chip backgrounds |
| `--amber` | `#D97706` | Pending date icon color |
| `--red` | `#DC2626` | Terminated status |
| `--page-bg` | `#f5f5f7` | App background (off-white) |
| `--card` | `#ffffff` | Card / panel surfaces |
| `--ink-1..5` | `#1d1d1f`→`#aeaeb2` | Text hierarchy (5 levels) |
| `--hairline` | `rgba(0,0,0,0.08)` | Borders, dividers |

- Tailwind `brand-*` palette updated to Space Blue family (50–900 shades)
- Keyframe animations added: `sheetIn` (detail panel slide-in from right), `fadeIn`, `liftIn` (modal), `spin`
- Utility classes: `.animate-sheet`, `.animate-fade`, `.animate-lift`, `.animate-spin`, `.scroll-area`

#### Layout: Sidebar Navigation (`App.jsx`)
- **Replaced** top horizontal tab bar with a **232 px fixed left sidebar**
- Sidebar: `linear-gradient(180deg, #2d3068 0%, #25285a 100%)`, `backdrop-filter: blur(20px)`
- Copper-gradient circular logo icon (Wifi icon, 32 px)
- Navigation section: 3 items (`Deal Tracker`, `Analytics`, `Companies`) with lucide icons
- **Quick Filters section** below nav — one-click status filters with colored dot indicators and live deal-count badges:
  - All deals (white)  |  Completed (teal `#00DEC8`)  |  In review (copper `#E8B194`)
  - Rumored (violet `#5872E0`)  |  Terminated (red `#e88090`)  |  PE-backed (violet)
- Footer row: live deal count in `--ink-5`, `--space-blue-hover` bg
- Toolbar: 56 px, `backdrop-filter: blur(20px)`, hairline bottom border, copper-gradient "Add deal" button, spinning refresh button

#### Deal Table (`DealTable.jsx`)
- Replaced `<table>` element with **CSS Grid** layout: `110px 1.4fr 18px 1.4fr 130px 100px 130px`
- Sticky header row with sort arrows (`ArrowUp`/`ArrowDown` lucide)
- Selected row: `--copper-soft` background + 3 px copper left accent bar
- Date column: teal dot (Completed/Completing), amber `Clock` icon (Pending/Rumored), red `X` icon (Terminated). Dates displayed in `Mon 'YY` format
- Acquirer/Target cells: 14 px 540-weight name + `TypeTag` chip below + PE badge (10.5 px violet-on-violet-soft) or subscriber count
- `ArrowRight` separator column between acquirer and target
- `StatusPill` component with colored dot indicator

#### Filter Bar (`FilterBar.jsx`)
- Full inline-style redesign (no Tailwind classes)
- 300 px search input on gray bg, hairline dividers
- Three custom `<select>` elements with `ChevronDown` icon overlay
- iOS-style toggle for PE-only filter (teal when on, animated 18 px thumb)
- Tabular-nums deal count display

#### Deal Detail Panel (`DealDetailPanel.jsx`)
- 460 px width, `animate-sheet` slide-in, hairline left border
- Sticky header: type·date label, `X` close button (28 px circle), Acquirer → Target (17 px 600 weight), `StatusPill` lg + 22 px deal value
- Scrollable body with `Section` components (icons: `DollarSign`, `Briefcase`, `Sparkles`, `BarChart2`, `MapPin`, `Tag`)
- PE Block: `--paper-2` bg, violet "PE Backer · {role}" label, firm name, type/AUM/HQ grid, portfolio chips
- KV grid: 120 px label column + value at 13.5 px

#### Implementation notes
- All new components use **inline styles** referencing CSS custom properties (no Tailwind class dependency)
- Analytics and Company Info pages continue using Tailwind classes (compatible via updated `brand-*` colors)
- All existing React state and logic preserved: `useLocalDeals`, `allDeals` memo, filters/sort/selectedId, `handleRefresh`, `handleCreateDeal`, `handleSaveDeal`, `onNavigateToDeal`, `counts` memo for Quick Filter badges
- Build output: clean Vite build ✓ (no TS/lint errors)

---

## 12. Known Limitations

| Area | Limitation |
|---|---|
| **Deal dates** | Single `date` field used for both announce and close dates. Completed deals show close date; others show announce date. `days_to_close` and `days_in_review` metrics cannot be precisely calculated. |
| **Valuation multiples** | No `homes_passed`, `ltm_ebitda`, or `unaffected_share_price` fields → EV/passing, EV/EBITDA, and premium-to-unaffected cannot be computed. |
| **Geographic heatmap** | Requires `react-simple-maps`; not yet installed. State codes exist on deals but no choropleth visualization yet. |
| **Public trading comps** | No live market data feed → public/private valuation gap chart not buildable without external data source. |
| **BEAD exposure flag** | Requires cross-reference with state BEAD award data; not yet implemented. |
| **RSS reliability** | Some RSS feeds (particularly SEC EDGAR) intermittently return empty or rate-limited responses. No retry or caching layer. |
| **No authentication** | App is entirely client-side; no user accounts or deal ownership. |
| **Bundle size** | Recharts adds ~4MB unminified; prod bundle ~675KB gzipped 199KB (within reason but worth monitoring). |

---

## 13. Future Roadmap

### Near-term enhancements
- [ ] **Separate announce/close dates** — add `announceDate` + `closeDate` fields to the deal schema to enable `days_to_close` and `days_in_review` metrics
- [ ] **EV/passing field** — add `homesPassedTarget` to deals; enables the EV/passing KPI, box-plot chart, and scatter plot per the dashboard spec
- [ ] **Geographic heatmap** — install `react-simple-maps`; plot deal activity by state using `acquired.geography`
- [ ] **Deal edit/delete** — extend `useLocalDeals` to support edits; add edit button to `DealDetailPanel` for user-added deals
- [ ] **Export** — CSV/Excel export of filtered deal list

### Medium-term
- [ ] **BEAD exposure flag** — cross-reference `acquired.geography` against state BEAD award data (NTIA publishes state-level subgrant data)
- [ ] **Convergence counter in KPI row** — count convergence deals TTM as a first-class KPI
- [ ] **Analyst notes field** — richer notes with markdown rendering in `DealDetailPanel`
- [ ] **RSS result caching** — cache last refresh result in `localStorage` with TTL; avoid re-fetching within 30 minutes

### Longer-term / requires external data
- [ ] **Live FCC 214 transfer feed** — parse FCC Daily Digest for transfer/license assignment filings
- [ ] **Public comp multiples** — integrate a market data feed (e.g. FRED, Quandl, or Yahoo Finance scrape) for public EV/EBITDA comps
- [ ] **Network graph** — `react-force-graph` visualization of acquirer → target relationships; highlights PE platform roll-up clusters
- [ ] **Multi-user / backend** — replace `localStorage` with a lightweight backend (e.g. Supabase or PlanetScale) for shared deal annotations
