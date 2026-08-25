# Evolutions Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Evolutions" workspace tab that lets users trace how any ISP entity has grown through M&A over time — a toggleable EV/subscriber chart on top, a compact-then-expandable deal timeline below.

**Architecture:** A single new `EvolutionsPage.jsx` containing pure chain-building functions, a Recharts AreaChart with clickable event pins, and a vertical timeline of accordion deal cards. Entry comes from either an in-page smart search or a Trace button added to each `DealTable` row. State is lifted in `App.jsx` via an `evolutionSeed` prop that pre-populates the search when navigating from the tracker.

**Tech Stack:** React 18, Recharts (already installed), lucide-react (`GitBranch` icon), inline styles matching the existing app pattern, `src/data/deals.json` as the data source.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/EvolutionsPage.jsx` | **Create** | Chain building logic, chart, timeline, search UI |
| `src/App.jsx` | **Modify** | Add `evolutions` tab, `evolutionSeed` + `setEvolutionSeed` state, wire DealTable `onTrace` |
| `src/components/DealTable.jsx` | **Modify** | Add hover-visible Trace button (`GitBranch`) per row |

---

## Task 1: App.jsx — Add the Evolutions tab and seed state

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add `GitBranch` to the lucide-react import and `EvolutionsPage` import**

In `src/App.jsx`, change line 2 from:
```js
import { Wifi, List, BarChart2, Building2, Wallet, RefreshCw, Plus } from 'lucide-react'
```
to:
```js
import { Wifi, List, BarChart2, Building2, Wallet, RefreshCw, Plus, GitBranch } from 'lucide-react'
```

Add after line 11 (`import FundMgmtPage`):
```js
import EvolutionsPage from './components/EvolutionsPage'
```

- [ ] **Step 2: Add the Evolutions tab to the TABS array**

Change the `TABS` constant from:
```js
const TABS = [
  { id: 'tracker',      label: 'Deal Tracker',  icon: List },
  { id: 'analytics',   label: 'Analytics',     icon: BarChart2 },
  { id: 'fund-mgmt',   label: 'Fund Mgmt',     icon: Wallet },
  { id: 'company-info', label: 'Companies',    icon: Building2 },
]
```
to:
```js
const TABS = [
  { id: 'tracker',      label: 'Deal Tracker',  icon: List },
  { id: 'analytics',   label: 'Analytics',     icon: BarChart2 },
  { id: 'fund-mgmt',   label: 'Fund Mgmt',     icon: Wallet },
  { id: 'company-info', label: 'Companies',    icon: Building2 },
  { id: 'evolutions',  label: 'Evolutions',    icon: GitBranch },
]
```

Add `evolutions` subtitle to `TAB_SUBTITLES`:
```js
const TAB_SUBTITLES = {
  tracker:        null,
  analytics:      'Charts & breakdowns',
  'fund-mgmt':    'PE fund dry powder, sector lean & saturation',
  'company-info': 'PE directory & ISP types',
  evolutions:     'Trace how any ISP entity has grown through M&A',
}
```

- [ ] **Step 3: Add `evolutionSeed` state and `handleTrace` callback**

Inside `App()`, after the existing `useState` declarations (around line 286), add:
```js
const [evolutionSeed, setEvolutionSeed] = useState(null)
```

Add this handler after `handleSaveDeal`:
```js
const handleTrace = (deal) => {
  setEvolutionSeed(deal.acquirer?.name ?? null)
  setActiveTab('evolutions')
}
```

- [ ] **Step 4: Pass `onTrace` to DealTable and wire EvolutionsPage**

In the `{activeTab === 'tracker'}` block, add `onTrace={handleTrace}` to `<DealTable>`:
```jsx
<DealTable
  deals={filtered}
  selectedId={selectedId}
  onSelect={setSelectedId}
  sort={sort}
  onSort={handleSort}
  onTrace={handleTrace}
/>
```

After the `{activeTab === 'company-info'}` block, add:
```jsx
{activeTab === 'evolutions' && (
  <EvolutionsPage
    deals={allDeals}
    seed={evolutionSeed}
    onSeedConsumed={() => setEvolutionSeed(null)}
    onNavigateToDeal={id => { setActiveTab('tracker'); setSelectedId(id) }}
  />
)}
```

- [ ] **Step 5: Verify the app still loads — open http://localhost:5173, confirm "Evolutions" tab appears in the sidebar and clicking it renders a blank area without errors**

---

## Task 2: DealTable.jsx — Add hover-visible Trace button

**Files:**
- Modify: `src/components/DealTable.jsx`

- [ ] **Step 1: Add `GitBranch` to the import**

Change line 1 from:
```js
import { ArrowUp, ArrowDown, ArrowUpDown, ArrowRight, Clock, X, Search } from 'lucide-react'
```
to:
```js
import { ArrowUp, ArrowDown, ArrowUpDown, ArrowRight, Clock, X, Search, GitBranch } from 'lucide-react'
```

- [ ] **Step 2: Add `onTrace` to the component signature**

Change:
```js
export default function DealTable({ deals, selectedId, onSelect, sort, onSort }) {
```
to:
```js
export default function DealTable({ deals, selectedId, onSelect, sort, onSort, onTrace }) {
```

- [ ] **Step 3: Add a `hovered` state to track which row is hovered**

Add at the top of `DealTable`:
```js
import { useState } from 'react'
```

(Add `useState` to the existing React import if it's already imported; otherwise add as a new import at line 1.)

Then inside `DealTable` before the `return`, add:
```js
const [hoveredId, setHoveredId] = useState(null)
```

- [ ] **Step 4: Wrap each row's cells to track hover and render the Trace button in the Status cell**

In the `{deals.map(deal => { ... })}` block, update the outer `div` (the `display: 'contents'` div) to track hover:

```jsx
<div
  key={deal.id}
  style={{ display: 'contents' }}
  onClick={() => onSelect(deal.id === selectedId ? null : deal.id)}
  onMouseEnter={() => setHoveredId(deal.id)}
  onMouseLeave={() => setHoveredId(null)}
>
```

- [ ] **Step 5: Add the Trace button inside the Status cell**

Find the Status cell (the last `<div style={cell(6)}>` containing `<StatusPill />`). Replace its contents with:

```jsx
<div
  style={{ ...cell(6), gap: 6 }}
  onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(0,0,0,0.025)' }}
  onMouseLeave={e => { if (!selected) e.currentTarget.style.background = '#ffffff' }}
>
  <StatusPill status={deal.status} />
  {onTrace && hoveredId === deal.id && (
    <button
      title="Trace evolution"
      onClick={e => { e.stopPropagation(); onTrace(deal) }}
      style={{
        marginLeft: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        borderRadius: 6,
        border: '1px solid rgba(88,114,224,0.3)',
        background: 'rgba(88,114,224,0.06)',
        color: '#5872E0',
        cursor: 'pointer',
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <GitBranch size={11} />
      Trace
    </button>
  )}
</div>
```

- [ ] **Step 6: Verify — hover over a deal row, confirm "Trace" button appears in the Status column. Click it; confirm the Evolutions tab activates (even if the page is empty for now)**

---

## Task 3: EvolutionsPage.jsx — Pure data functions

**Files:**
- Create: `src/components/EvolutionsPage.jsx`

- [ ] **Step 1: Create the file with helper functions**

Create `src/components/EvolutionsPage.jsx` with the following content (functions only, no JSX yet):

```jsx
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { GitBranch } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'

// ── Brand palette ─────────────────────────────────────────────────────────────
const DEAL_TYPE_COLOR = {
  'Acquisition':        '#955438',
  'Asset Acquisition':  '#955438',
  'Consolidation':      '#2D3068',
  'Merger':             '#2D3068',
  'Partial Stake Sale': '#00DEC8',
  'Joint Venture':      '#5872E0',
  'Recapitalization':   '#5872E0',
}
const PENDING_STATUSES = new Set([
  'Pending / Regulatory Review',
  'Rumored / In Discussions',
])

function dealColor(deal) {
  const base = DEAL_TYPE_COLOR[deal?.dealType] ?? '#9ca3af'
  return PENDING_STATUSES.has(deal?.status) ? base + 'aa' : base
}

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtVal = v =>
  v == null ? '—'
  : v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B`
  : v >= 1e6 ? `$${(v / 1e6).toFixed(0)}M`
  : `$${v.toLocaleString()}`

const fmtSubs = v =>
  v == null ? '—'
  : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M`
  : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K`
  : v.toLocaleString()

const fmtDate = iso => {
  if (!iso) return '—'
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short', year: 'numeric',
    })
  } catch { return iso.slice(0, 7) }
}

// ── Chain building ────────────────────────────────────────────────────────────

/**
 * Given a query string, return all deals whose acquirer.name or acquired.name
 * contains the query (case-insensitive). Then expand predecessor entities for
 * any "Consolidation" deals found.
 * Returns { chain: Deal[], predecessors: string[] }
 */
export function buildChain(query, deals, pinnedPredecessors = []) {
  if (!query.trim()) return { chain: [], predecessors: [] }
  const q = query.toLowerCase()

  // 1. Direct matches
  const direct = deals.filter(d =>
    d.acquirer?.name?.toLowerCase().includes(q) ||
    d.acquired?.name?.toLowerCase().includes(q)
  )

  // 2. Predecessor expansion from Consolidation deals
  const predecessorNames = new Set(pinnedPredecessors)
  direct.forEach(d => {
    if (d.dealType === 'Consolidation') {
      // acquired.name is like "RCN Telecom + WaveDivision + Grande Communications (Consolidated into Astound)"
      // Split on + to extract constituent names, drop content in parens
      const raw = d.acquired?.name ?? ''
      const stripped = raw.replace(/\s*\([^)]*\)/g, '') // remove "(Consolidated into Astound)"
      stripped.split(/\s*\+\s*/).map(s => s.trim()).filter(Boolean).forEach(p => {
        if (!p.toLowerCase().includes(q)) predecessorNames.add(p)
      })
    }
  })

  // 3. Find deals for each predecessor (use first 2 words to match)
  const seen = new Set(direct.map(d => d.id))
  const predecessorDeals = []
  predecessorNames.forEach(pred => {
    const words = pred.split(/\s+/).slice(0, 2).join(' ').toLowerCase()
    deals.forEach(d => {
      if (seen.has(d.id)) return
      if (
        d.acquirer?.name?.toLowerCase().includes(words) ||
        d.acquired?.name?.toLowerCase().includes(words)
      ) {
        seen.add(d.id)
        predecessorDeals.push(d)
      }
    })
  })

  // 4. Combine, deduplicate, sort newest first
  const chain = [...direct, ...predecessorDeals]
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  return { chain, predecessors: [...predecessorNames] }
}

/**
 * Return up to 8 unique entity names from deals.json whose acquirer.name or
 * acquired.name contains `query`. Sorted by deal count descending.
 */
export function getSearchSuggestions(query, deals) {
  if (!query.trim()) return []
  const q = query.toLowerCase()
  const map = new Map()
  deals.forEach(d => {
    ;[d.acquirer?.name, d.acquired?.name].forEach(name => {
      if (name?.toLowerCase().includes(q)) {
        map.set(name, (map.get(name) ?? 0) + 1)
      }
    })
  })
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }))
}

/**
 * Build Recharts-compatible data array from a chain.
 * mode: 'ev' | 'subs'
 * For 'ev': cumulative sum of dealValue (oldest→newest).
 * For 'subs': the deal's subscribers value (can be null).
 */
export function buildChartData(chain, mode) {
  if (!chain.length) return []
  const sorted = [...chain].sort((a, b) => new Date(a.date) - new Date(b.date))
  let cumEv = 0
  return sorted.map(deal => {
    if (mode === 'ev') {
      cumEv += deal.dealValue ?? 0
      return {
        date: deal.date,
        label: fmtDate(deal.date),
        value: cumEv,
        dealId: deal.id,
        rawValue: deal.dealValue,
      }
    }
    return {
      date: deal.date,
      label: fmtDate(deal.date),
      value: deal.subscribers ?? null,
      dealId: deal.id,
      rawValue: deal.subscribers,
    }
  })
}

// ── Placeholder export (replaced in later tasks) ──────────────────────────────
export default function EvolutionsPage() {
  return <div style={{ padding: 40, color: '#9ca3af' }}>Evolutions — coming soon</div>
}
```

- [ ] **Step 2: Verify the file parses — navigate to the Evolutions tab in the running app, confirm "Evolutions — coming soon" renders with no console errors**

---

## Task 4: EvolutionsPage.jsx — Search bar + predecessor pills

**Files:**
- Modify: `src/components/EvolutionsPage.jsx`

- [ ] **Step 1: Replace the placeholder export with the full page shell including search**

Replace the `export default function EvolutionsPage()` placeholder at the bottom of the file with:

```jsx
const STATUS_SHORT = {
  'Completed':                   'Completed',
  'Pending / Regulatory Review': 'In Review',
  'Rumored / In Discussions':    'Rumored',
  'Terminated':                  'Terminated',
}
const STATUS_COLORS = {
  'Completed':                   { bg: '#d6f8f4', text: '#007a6e' },
  'Pending / Regulatory Review': { bg: '#FEF3C7', text: '#92400e' },
  'Rumored / In Discussions':    { bg: '#e6eafe', text: '#3f56c0' },
  'Terminated':                  { bg: '#FEE2E2', text: '#b91c1c' },
}

const SUGGESTIONS_EXAMPLES = ['Astound Broadband', 'T-Mobile US', 'EQT Infrastructure']

export default function EvolutionsPage({ deals, seed, onSeedConsumed, onNavigateToDeal }) {
  const [inputVal, setInputVal]         = useState('')
  const [selectedEntity, setSelectedEntity] = useState(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [pinnedPredecessors, setPinnedPredecessors] = useState([])
  const [chartMode, setChartMode]       = useState('ev')   // 'ev' | 'subs'
  const [expandedId, setExpandedId]     = useState(null)
  const cardRefs                        = useRef({})
  const inputRef                        = useRef(null)

  // Consume seed from Deal Tracker "Trace" button
  useEffect(() => {
    if (seed) {
      setInputVal(seed)
      setSelectedEntity(seed)
      setPinnedPredecessors([])
      setExpandedId(null)
      onSeedConsumed?.()
    }
  }, [seed, onSeedConsumed])

  const suggestions = useMemo(
    () => getSearchSuggestions(inputVal, deals),
    [inputVal, deals]
  )

  const { chain, predecessors } = useMemo(
    () => buildChain(selectedEntity ?? '', deals, pinnedPredecessors),
    [selectedEntity, deals, pinnedPredecessors]
  )

  const chartData = useMemo(
    () => buildChartData(chain, chartMode),
    [chain, chartMode]
  )

  const handleSelectEntity = useCallback((name) => {
    setSelectedEntity(name)
    setInputVal(name)
    setShowDropdown(false)
    setPinnedPredecessors([])
    setExpandedId(null)
  }, [])

  const handleClear = () => {
    setInputVal('')
    setSelectedEntity(null)
    setPinnedPredecessors([])
    setExpandedId(null)
    inputRef.current?.focus()
  }

  const handlePinClick = useCallback((dealId) => {
    setExpandedId(dealId)
    setTimeout(() => {
      cardRefs.current[dealId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }, [])

  const handleRemovePredecessor = (pred) => {
    setPinnedPredecessors(prev => prev.filter(p => p !== pred))
  }

  return (
    <div className="scroll-area" style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', background: '#f5f5f7', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Search row ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', position: 'relative' }}>
        {/* Search input */}
        <div style={{ position: 'relative', width: 380 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#fff', border: '1.5px solid',
            borderColor: showDropdown ? '#5872E0' : '#e5e7eb',
            borderRadius: 8, padding: '8px 12px',
            boxShadow: showDropdown ? '0 0 0 3px rgba(88,114,224,0.12)' : '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}>
            <GitBranch size={15} style={{ color: '#9ca3af', flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={inputVal}
              placeholder="Search company, ISP, or PE firm…"
              onChange={e => {
                setInputVal(e.target.value)
                setSelectedEntity(null)
                setShowDropdown(true)
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              style={{
                flex: 1, border: 'none', outline: 'none', fontSize: 13,
                color: '#1a1a2e', background: 'transparent',
              }}
            />
            {inputVal && (
              <button onClick={handleClear} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#d1d5db', fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0,
              }}>×</button>
            )}
          </div>

          {/* Dropdown */}
          {showDropdown && suggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.1)', marginTop: 4, overflow: 'hidden',
            }}>
              {suggestions.map(s => (
                <div
                  key={s.name}
                  onMouseDown={() => handleSelectEntity(s.name)}
                  style={{
                    padding: '9px 14px', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', cursor: 'pointer', fontSize: 13,
                    borderBottom: '1px solid #f3f4f6',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#EEF1FD'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                >
                  <span style={{ fontWeight: 500, color: '#1a1a2e' }}>{s.name}</span>
                  <span style={{
                    fontSize: 11, color: '#9ca3af', background: '#f3f4f6',
                    padding: '1px 6px', borderRadius: 4,
                  }}>{s.count} deal{s.count !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Predecessor pills */}
        {predecessors.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', paddingTop: 8 }}>
            {predecessors.map(p => (
              <span key={p} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 11, padding: '4px 10px', borderRadius: 20, fontWeight: 500,
                background: '#FFF7ED', color: '#955438', border: '1px solid #fcd9a0',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#955438', display: 'inline-block' }} />
                {p} (predecessor)
                <button
                  onClick={() => handleRemovePredecessor(p)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B8744F', fontSize: 14, padding: 0, lineHeight: 1 }}
                >×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Body: chart + timeline OR empty state ── */}
      {!selectedEntity ? (
        /* Empty state — no selection yet */
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '64px 0', gap: 14, color: '#9ca3af',
        }}>
          <GitBranch size={40} style={{ opacity: 0.25 }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: '#6b7280' }}>
            Search for a company above, or click Trace on any Deal Tracker row
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
            {SUGGESTIONS_EXAMPLES.map(s => (
              <button
                key={s}
                onClick={() => handleSelectEntity(s)}
                style={{
                  padding: '7px 16px', borderRadius: 20, border: '1px solid #e5e7eb',
                  background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151',
                  fontWeight: 500, transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#5872E0'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : chain.length === 0 ? (
        /* Empty state — query returned no deals */
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '64px 0', gap: 12, color: '#9ca3af',
        }}>
          <GitBranch size={40} style={{ opacity: 0.25 }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: '#6b7280' }}>
            No evolution chain found for "{selectedEntity}"
          </p>
          <p style={{ fontSize: 13 }}>Try searching for a company or ISP name that appears in the Deal Tracker.</p>
        </div>
      ) : (
        /* Main content */
        <>
          {/* Chart placeholder — filled in Task 5 */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.07)', padding: 20, minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
            Chart — Task 5
          </div>

          {/* Timeline placeholder — filled in Task 6 */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.07)', padding: 20, minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
            Timeline — Task 6
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify — search "Astound" in the Evolutions tab, confirm the dropdown appears with suggestions, selecting one shows "Chart — Task 5" and "Timeline — Task 6" placeholders, and predecessor pills appear below the search box**

---

## Task 5: EvolutionsPage.jsx — Recharts chart with event pins and toggle

**Files:**
- Modify: `src/components/EvolutionsPage.jsx`

- [ ] **Step 1: Add the `ChartCard` component above the `EvolutionsPage` export**

Insert this component above `export default function EvolutionsPage`:

```jsx
function ChartCard({ chain, chartData, chartMode, setChartMode, onPinClick }) {
  const title = chain.length
    ? `${chain[chain.length - 1]?.acquirer?.name ?? ''} · Capital & Scale Over Time`
    : ''

  const yFmt = v => {
    if (v == null) return ''
    if (chartMode === 'ev') {
      return v >= 1e9 ? `$${(v / 1e9).toFixed(0)}B`
           : v >= 1e6 ? `$${(v / 1e6).toFixed(0)}M`
           : `$${v}`
    }
    return v >= 1e6 ? `${(v / 1e6).toFixed(1)}M`
         : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K`
         : `${v}`
  }

  const CustomDot = (props) => {
    const { cx, cy, payload } = props
    if (!payload?.dealId || cx == null || cy == null) return null
    const deal = chain.find(d => d.id === payload.dealId)
    if (!deal) return null
    const color = dealColor(deal)
    return (
      <circle
        key={`pin-${payload.dealId}`}
        cx={cx} cy={cy} r={6}
        fill="#fff"
        stroke={color}
        strokeWidth={2.5}
        style={{ cursor: 'pointer' }}
        onClick={() => onPinClick(payload.dealId)}
      />
    )
  }

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const pt = payload[0]?.payload
    if (!pt) return null
    const deal = chain.find(d => d.id === pt.dealId)
    return (
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
        padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        fontSize: 12, maxWidth: 240,
      }}>
        <p style={{ fontWeight: 700, color: '#1a1a2e', marginBottom: 3 }}>
          {deal?.acquirer?.name ?? ''}
        </p>
        <p style={{ color: '#6b7280' }}>
          {chartMode === 'ev' ? fmtVal(pt.value) : fmtSubs(pt.value)}
          {chartMode === 'ev' ? ' cumulative EV' : ' subscribers'}
        </p>
        <p style={{ color: '#9ca3af', marginTop: 2 }}>{pt.label}</p>
      </div>
    )
  }

  const validData = chartMode === 'subs'
    ? chartData.filter(d => d.value != null)
    : chartData

  return (
    <div style={{
      background: '#fff', borderRadius: 12,
      border: '1px solid rgba(0,0,0,0.07)', padding: '18px 20px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{title}</p>
          <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
            {chain.length} deal event{chain.length !== 1 ? 's' : ''} · click any pin for detail
          </p>
        </div>
        {/* Toggle */}
        <div style={{
          display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 2, gap: 2,
        }}>
          {[['ev', '$ Cumulative EV'], ['subs', '👥 Subscribers']].map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setChartMode(mode)}
              style={{
                padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 600,
                background: chartMode === mode ? '#fff' : 'transparent',
                color: chartMode === mode ? '#2D3068' : '#6b7280',
                boxShadow: chartMode === mode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={validData} margin={{ top: 16, right: 20, left: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="evGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2D3068" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#2D3068" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            tickFormatter={yFmt}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            axisLine={false} tickLine={false} width={55}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#2D3068"
            strokeWidth={2}
            fill="url(#evGrad)"
            connectNulls={chartMode === 'subs'}
            dot={<CustomDot />}
            activeDot={false}
          />
        </AreaChart>
      </ResponsiveContainer>

      {chartMode === 'subs' && chartData.some(d => d.value == null) && (
        <p style={{ fontSize: 11, color: '#D97706', marginTop: 8 }}>
          ⚠ Some events have no subscriber data — shown as line gaps
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Replace the chart placeholder in the main body**

In the main content section of `EvolutionsPage`, replace:
```jsx
{/* Chart placeholder — filled in Task 5 */}
<div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.07)', padding: 20, minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
  Chart — Task 5
</div>
```

with:
```jsx
<ChartCard
  chain={chain}
  chartData={chartData}
  chartMode={chartMode}
  setChartMode={setChartMode}
  onPinClick={handlePinClick}
/>
```

- [ ] **Step 3: Verify — select "Astound Broadband" in the search. Confirm a Recharts area chart appears with colored dots on the curve, toggling to "👥 Subscribers" changes the Y-axis, and clicking a dot triggers `handlePinClick` (visible as a no-op until Task 6)**

---

## Task 6: EvolutionsPage.jsx — Timeline with accordion deal cards

**Files:**
- Modify: `src/components/EvolutionsPage.jsx`

- [ ] **Step 1: Add the `DealCard` component above `ChartCard`**

Insert this before `function ChartCard`:

```jsx
function DealCard({ deal, isExpanded, onToggle, onNavigateToDeal, innerRef }) {
  const year  = deal.date?.slice(0, 4) ?? '—'
  const color = dealColor(deal)
  const val   = fmtVal(deal.dealValue)
  const sc    = STATUS_COLORS[deal.status] ?? { bg: '#f3f4f6', text: '#6b7280' }
  const name  = deal.acquirer?.name
    ? `${deal.acquirer.name}${deal.acquired?.name ? ` → ${deal.acquired.name}` : ''}`
    : deal.acquired?.name ?? '—'

  if (!isExpanded) {
    return (
      <div
        ref={innerRef}
        onClick={onToggle}
        style={{
          background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8,
          padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10,
          cursor: 'pointer', transition: 'background 0.12s, border-color 0.12s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#EEF1FD'; e.currentTarget.style.borderColor = '#c7d0f5' }}
        onMouseLeave={e => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#e5e7eb' }}
      >
        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, width: 32, flexShrink: 0 }}>
          {year}
        </span>
        <span style={{
          flex: 1, fontSize: 13, fontWeight: 600, color: '#1a1a2e',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {name}
        </span>
        <span style={{
          fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 600,
          background: '#f3f4f6', color: '#6b7280', whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {deal.dealType}
        </span>
        <span style={{
          fontSize: 13, fontWeight: 700, color: '#2D3068',
          minWidth: 50, textAlign: 'right', flexShrink: 0,
        }}>
          {val}
        </span>
        <span style={{ color: '#d1d5db', fontSize: 12, flexShrink: 0 }}>▼</span>
      </div>
    )
  }

  const excerpt = deal.keyTerms
    ? deal.keyTerms.slice(0, 200) + (deal.keyTerms.length > 200 ? '…' : '')
    : null

  return (
    <div ref={innerRef} style={{
      background: '#fff', border: `1.5px solid ${color}`,
      borderRadius: 10, overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        onClick={onToggle}
        style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
      >
        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, width: 32, flexShrink: 0 }}>
          {year}
        </span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </span>
        <span style={{ fontSize: 15, fontWeight: 800, color, flexShrink: 0 }}>{val}</span>
        <span style={{ color, fontSize: 12, flexShrink: 0 }}>▲</span>
      </div>

      {/* Metrics + excerpt */}
      <div style={{ padding: '12px 16px', background: '#f9fafb', borderTop: '1px solid #f0f0f0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: excerpt ? 12 : 0 }}>
          {[
            { v: fmtSubs(deal.subscribers),                              lbl: 'Subscribers'  },
            { v: deal.geography?.length ?? '—',                          lbl: 'States'       },
            { v: '—',                                                     lbl: 'Passings'     },
            { v: deal.ownershipPct != null ? `${deal.ownershipPct}%` : '—', lbl: 'Ownership' },
          ].map(({ v, lbl }) => (
            <div key={lbl} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1a2e' }}>{v}</div>
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{lbl}</div>
            </div>
          ))}
        </div>
        {excerpt && (
          <p style={{
            fontSize: 11.5, color: '#6b7280', fontStyle: 'italic', lineHeight: 1.6,
            borderLeft: `3px solid ${color}`, paddingLeft: 10, margin: 0,
          }}>
            {excerpt}
          </p>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '7px 14px', background: '#fff', borderTop: '1px solid #f0f0f0',
        display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 600, background: sc.bg, color: sc.text }}>
          {STATUS_SHORT[deal.status] ?? deal.status}
        </span>
        {deal.acquired?.type && (
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 600, background: '#f3f4f6', color: '#6b7280' }}>
            {deal.acquired.type}
          </span>
        )}
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 600, background: '#f3f4f6', color: '#6b7280' }}>
          {deal.dealType}
        </span>
        <button
          onClick={e => { e.stopPropagation(); onNavigateToDeal(deal.id) }}
          style={{
            marginLeft: 'auto', fontSize: 11, color: '#5872E0', fontWeight: 600,
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          ↗ Full deal
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add the `TimelineCard` component above `ChartCard`**

Insert this between `DealCard` and `ChartCard`:

```jsx
function TimelineCard({ chain, expandedId, setExpandedId, cardRefs, onNavigateToDeal }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12,
      border: '1px solid rgba(0,0,0,0.07)', padding: '18px 20px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>Deal Timeline</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>
            {chain.length} event{chain.length !== 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>newest ↑ &nbsp;·&nbsp; ↓ oldest</span>
        </div>
      </div>

      {/* Spine + cards */}
      <div style={{ display: 'flex', gap: 14 }}>
        {/* Spine */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 10, flexShrink: 0 }}>
          {chain.map((deal, i) => (
            <div key={deal.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                border: '2px solid #fff',
                boxShadow: `0 0 0 2px ${dealColor(deal)}`,
                background: expandedId === deal.id ? dealColor(deal) : '#fff',
              }} />
              {i < chain.length - 1 && (
                <div style={{ width: 2, flex: 1, background: '#e5e7eb', margin: '4px 0', minHeight: 32 }} />
              )}
            </div>
          ))}
        </div>

        {/* Cards column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {chain.map(deal => (
            <DealCard
              key={deal.id}
              deal={deal}
              isExpanded={expandedId === deal.id}
              onToggle={() => setExpandedId(expandedId === deal.id ? null : deal.id)}
              onNavigateToDeal={onNavigateToDeal}
              innerRef={el => { cardRefs.current[deal.id] = el }}
            />
          ))}
        </div>
      </div>

      <div style={{
        textAlign: 'center', fontSize: 11, color: '#d1d5db',
        marginTop: 14, paddingTop: 14, borderTop: '1px dashed #e5e7eb',
      }}>
        — oldest deal in chain —
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Replace the timeline placeholder in `EvolutionsPage`**

In the main content section, replace:
```jsx
{/* Timeline placeholder — filled in Task 6 */}
<div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.07)', padding: 20, minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
  Timeline — Task 6
</div>
```

with:
```jsx
<TimelineCard
  chain={chain}
  expandedId={expandedId}
  setExpandedId={setExpandedId}
  cardRefs={cardRefs}
  onNavigateToDeal={onNavigateToDeal}
/>
```

- [ ] **Step 4: Verify end-to-end**

Open the app, navigate to Evolutions, search "Astound Broadband":
- [ ] Chart appears with event pins
- [ ] Timeline shows deals newest-first (GFiber merger 2026 at top, RCN 2019 at bottom)
- [ ] Clicking a compact row expands it showing the 4-metric grid + key-terms excerpt + "↗ Full deal" button
- [ ] Only one card is open at a time (accordion)
- [ ] Clicking a chart pin expands the matching card and scrolls it into view
- [ ] Clicking "↗ Full deal" navigates to the Deal Tracker and opens the detail panel
- [ ] Toggle to "👥 Subscribers" changes the chart Y-axis
- [ ] Predecessor pills (RCN, WaveDivision, Grande) appear below the search bar

- [ ] **Step 5: Verify the Trace button flow**

Go to Deal Tracker, hover over any deal row → "Trace" button appears in the Status column. Click it → Evolutions tab activates with that deal's acquirer pre-loaded in the search and chain displayed.

---

## Task 7: Final wiring — commit

**Files:**
- `src/App.jsx`, `src/components/DealTable.jsx`, `src/components/EvolutionsPage.jsx`

- [ ] **Step 1: Smoke-test the full flow one more time**

1. Deal Tracker → hover a row → click Trace → Evolutions loads with acquirer pre-filled
2. Evolutions search → type "EQT" → select "EQT Infrastructure" → chain and chart load
3. Chart pin click → matching timeline card expands and scrolls into view
4. Expand a card → click "↗ Full deal" → Deal Tracker opens with that deal selected
5. Toggle chart mode EV ↔ Subscribers
6. Clear the search (×) → empty state with example chips returns
7. Click "T-Mobile US" suggestion chip → T-Mobile's JV chain loads

- [ ] **Step 2: Commit**

```bash
git add src/App.jsx src/components/DealTable.jsx src/components/EvolutionsPage.jsx docs/superpowers/specs/2026-06-08-evolutions-design.md docs/superpowers/plans/2026-06-08-evolutions-page.md
git commit -m "feat: add Evolutions workspace — ISP entity M&A timeline with chart and accordion deal cards"
```

---

## Self-Review Notes

- **Spec coverage**: All sections covered — navigation ✅, smart search ✅, Trace button ✅, chain building ✅, predecessor expansion ✅, chart with toggle ✅, timeline accordion ✅, empty states (both variants) ✅, "↗ Full deal" navigation ✅
- **No placeholders**: All code is complete and concrete
- **Type consistency**: `buildChain` / `buildChartData` / `getSearchSuggestions` defined in Task 3, referenced identically in Tasks 4–6; `dealColor` used consistently; `cardRefs` is `useRef({})` set with `innerRef` prop and read in `handlePinClick`
- **Passings field**: `deal.json` has no `passings` field — correctly shows `'—'` in the metric grid
