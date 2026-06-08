# Evolutions Page — Design Spec
_Date: 2026-06-08_

## Overview

A new "Evolutions" workspace tab that lets users trace how any ISP entity has grown through M&A over time. The canonical example: TPG bought RCN, WaveDivision, and Grande → merged them into Astound → sold Astound to Stonepeak → Stonepeak is now merging with GFiber. All of that becomes a single visual narrative.

---

## Navigation

- Add **"Evolutions"** as a 5th tab in the sidebar nav (App.jsx `TABS` array), after Companies.
- Icon: `GitBranch` from lucide-react.
- Subtitle: `"Trace how any ISP entity has grown through M&A"`
- No badge/count needed.

---

## Company Selection — Two Entry Points

### 1. Smart Search (within Evolutions page)
- Text input at the top of the page: `"Search company, ISP, or PE firm…"`
- As the user types, filter all unique `acquirer.name` and `acquired.name` values from `deals.json` (case-insensitive substring match).
- Show a dropdown of up to 8 results, each showing:
  - Entity name
  - Deal count (how many deals it appears in)
  - Role label: "ISP platform", "PE firm", or "Acquirer"
- On selection: load that entity's evolution chain (see Chain Building below).

### 2. "Trace" Button from Deal Tracker
- Add a subtle **Trace** icon button (`GitBranch` icon, 14px) to each row in `DealTable.jsx`, visible on row hover.
- Clicking it: sets the active tab to `evolutions` and pre-loads the evolution chain for `deal.acquirer.name`.
- Pass the pre-load via lifted state in App.jsx (a new `evolutionSeed` state, cleared after consumed).

---

## Chain Building Logic

Given a selected entity name, build the chain as follows:

1. **Direct match**: Find all deals where `deal.acquirer.name` or `deal.acquired.name` contains the search string (case-insensitive).
2. **Predecessor expansion**: For any matched deal of type `"Consolidation"` (e.g. Astound formation), also include deals where any of the constituent entities in `deal.acquired.name` appear as acquirer or target in other deals. This surfaces the pre-formation acquisitions (RCN, Wave, Grande) automatically.
3. **Deduplication**: Deduplicate by `deal.id`.
4. **Sort**: By `deal.date` descending (newest first) for the timeline display.

**Predecessor pills**: After chain building, show detected predecessor entities as dismissable pills below the search bar (e.g. "RCN (predecessor)", "WaveDivision (predecessor)"). User can click `+ add entity` to manually include additional names.

---

## Page Layout

```
┌─────────────────────────────────────────────────────────┐
│  [Search box: "Astound Broadband" ×]  [Predecessor pills]│
├─────────────────────────────────────────────────────────┤
│  CHART CARD                                              │
│  Title + [$ Cumulative EV | 👥 Subscribers] toggle       │
│  Recharts AreaChart — event pins on the line             │
├─────────────────────────────────────────────────────────┤
│  TIMELINE CARD                                           │
│  "6 events · newest ↑ · ↓ oldest"                       │
│  [Spine dots + cards, newest at top, oldest at bottom]   │
└─────────────────────────────────────────────────────────┘
```

---

## Chart Section

**Library**: Recharts `AreaChart` (consistent with rest of app).

**X-axis**: Time (deal dates, formatted as `MMM YYYY`).

**Y-axis toggle** (two modes, swapped by a pill toggle in the card header):
- **$ Cumulative EV** (default): step-function line where each event adds its `dealValue` to the running total. If `dealValue` is null, the line stays flat at the previous value (no gap).
- **👥 Subscribers**: value from `deal.subscribers` (or `deal.acquired.subscribers` where available). Null values shown as dashed/faded line segment with a `—` label.

**Event pins**: Custom `<dot>` rendered at each deal date on the curve. Color-coded by deal type:
- Acquisition: `#955438` (Copper)
- Consolidation/Merger: `#2D3068` (Space Blue)
- Sale/Secondary: `#00DEC8` (Digital Teal)
- Joint Venture: `#5872E0` (Ultraviolet)
- Pending: lighter opacity variant of the above

Clicking a pin scrolls the timeline to that deal card and expands it.

---

## Timeline Section

### Default (Compact) State
Each deal renders as a single-row card:
```
[year] [deal name ··············] [badge] [$value] [▼]
```
- Clicking anywhere on the row expands it.
- The dot on the spine matches the deal-type color.

### Expanded State
Replaces the compact row with a full panel:
```
┌─────────────────────────────────────────────────────┐
│ [year] Deal Name                     $Value     [▲] │
├─────────────────────────────────────────────────────┤
│  Subscribers | States | Passings | Ownership%       │  ← metric grid
│  "Key terms excerpt (first 200 chars)…"             │  ← italic quote
│  [Status badge] [ISP type] [deal type]  [↗ Full deal]│  ← footer
└─────────────────────────────────────────────────────┘
```
- **Subscribers / States / Passings / Ownership**: pulled directly from `deal.subscribers`, `deal.geography.length`, and `deal.ownershipPct`. Show `—` when null.
- **Key terms excerpt**: `deal.keyTerms.slice(0, 200) + "…"`, styled as italic block-quote with left border.
- **"↗ Full deal"**: switches to the Deal Tracker tab and opens the detail panel for this deal.

Only one card is expanded at a time (accordion behavior). Pin clicks from the chart expand the targeted card and collapse any other open card.

---

## Empty / No-match State

When search returns no matching deals:
```
[GitBranch icon]
No evolution chain found for "[query]"
Try searching for a company or ISP name that appears in the Deal Tracker.
```

When the page first loads with no selection:
```
[GitBranch icon]
Search for a company above, or click Trace on any Deal Tracker row
[Show 3 example chains as suggestion chips: "Astound Broadband", "T-Mobile fiber JVs", "EQT Infrastructure"]
```

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `src/components/EvolutionsPage.jsx` | **Create** — new page component |
| `src/App.jsx` | Add `evolutions` to `TABS`; add `evolutionSeed` state; pass to `EvolutionsPage` and `DealTable` |
| `src/components/DealTable.jsx` | Add hover-visible Trace button per row; call `onTrace(deal)` prop |

---

## Out of Scope (v1)

- Saving / bookmarking a chain
- Manually reordering deals in the chain
- Sharing a chain via URL
- Org chart / tree view of subsidiaries
- Exporting the evolution as PDF/image
