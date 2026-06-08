import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
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
export function buildChain(query, deals, pinnedPredecessors = [], excludedPredecessors = []) {
  if (!query.trim()) return { chain: [], predecessors: [] }
  const q = query.toLowerCase()

  const direct = deals.filter(d =>
    d.acquirer?.name?.toLowerCase().includes(q) ||
    d.acquired?.name?.toLowerCase().includes(q)
  )

  const predecessorNames = new Set(pinnedPredecessors)
  direct.forEach(d => {
    if (d.dealType === 'Consolidation') {
      const raw = d.acquired?.name ?? ''
      const stripped = raw.replace(/\s*\([^)]*\)/g, '')
      stripped.split(/\s*\+\s*/).map(s => s.trim()).filter(Boolean).forEach(p => {
        if (!p.toLowerCase().includes(q)) predecessorNames.add(p)
      })
    }
  })

  // Remove any user-dismissed predecessors
  excludedPredecessors.forEach(p => predecessorNames.delete(p))

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

  const chain = [...direct, ...predecessorDeals]
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  return { chain, predecessors: [...predecessorNames] }
}

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

// ── Status display maps ───────────────────────────────────────────────────────
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

// ── DealCard ──────────────────────────────────────────────────────────────────
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

      <div style={{ padding: '12px 16px', background: '#f9fafb', borderTop: '1px solid #f0f0f0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: excerpt ? 12 : 0 }}>
          {[
            { v: fmtSubs(deal.subscribers),                                  lbl: 'Subscribers' },
            { v: deal.geography?.length ?? '—',                              lbl: 'States'      },
            { v: '—',                                                         lbl: 'Passings'    },
            { v: deal.ownershipPct != null ? `${deal.ownershipPct}%` : '—',  lbl: 'Ownership'   },
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

// ── TimelineCard ──────────────────────────────────────────────────────────────
const TimelineCard = memo(function TimelineCard({ chain, expandedId, setExpandedId, cardRefs, onNavigateToDeal }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12,
      border: '1px solid rgba(0,0,0,0.07)', padding: '18px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>Deal Timeline</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>
            {chain.length} event{chain.length !== 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>newest ↑ &nbsp;·&nbsp; ↓ oldest</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14 }}>
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
})

// ── ChartCard ─────────────────────────────────────────────────────────────────
const ChartCard = memo(function ChartCard({ chain, chartData, chartMode, setChartMode, onPinClick }) {
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
          {deal?.acquirer?.name
            ? `${deal.acquirer.name}${deal.acquired?.name ? ` → ${deal.acquired.name}` : ''}`
            : deal?.acquired?.name ?? ''}
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
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{title}</p>
          <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
            {chain.length} deal event{chain.length !== 1 ? 's' : ''} · click any pin for detail
          </p>
        </div>
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
})

// ── EvolutionsPage ────────────────────────────────────────────────────────────
export default function EvolutionsPage({ deals, seed, onSeedConsumed, onNavigateToDeal }) {
  const [inputVal, setInputVal]             = useState('')
  const [selectedEntity, setSelectedEntity] = useState(null)
  const [showDropdown, setShowDropdown]     = useState(false)
  const [pinnedPredecessors, setPinnedPredecessors] = useState([])
  const [excludedPredecessors, setExcludedPredecessors] = useState([])
  const [chartMode, setChartMode]           = useState('ev')
  const [expandedId, setExpandedId]         = useState(null)
  const cardRefs                            = useRef({})
  const inputRef                            = useRef(null)

  useEffect(() => {
    if (seed) {
      setInputVal(seed)
      setSelectedEntity(seed)
      setPinnedPredecessors([])
      setExcludedPredecessors([])
      setExpandedId(null)
      onSeedConsumed?.()
    }
  }, [seed, onSeedConsumed])

  const suggestions = useMemo(
    () => getSearchSuggestions(inputVal, deals),
    [inputVal, deals]
  )

  const { chain, predecessors } = useMemo(
    () => buildChain(selectedEntity ?? '', deals, pinnedPredecessors, excludedPredecessors),
    [selectedEntity, deals, pinnedPredecessors, excludedPredecessors]
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
    setExcludedPredecessors([])
    setExpandedId(null)
  }, [])

  const handleClear = () => {
    setInputVal('')
    setSelectedEntity(null)
    setPinnedPredecessors([])
    setExcludedPredecessors([])
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
    setExcludedPredecessors(prev => [...prev, pred])
  }

  return (
    <div className="scroll-area" style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', background: '#f5f5f7', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Search row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', position: 'relative' }}>
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

      {!selectedEntity ? (
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
        <>
          <ChartCard
            chain={chain}
            chartData={chartData}
            chartMode={chartMode}
            setChartMode={setChartMode}
            onPinClick={handlePinClick}
          />
          <TimelineCard
            chain={chain}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            cardRefs={cardRefs}
            onNavigateToDeal={onNavigateToDeal}
          />
        </>
      )}
    </div>
  )
}
