import { useState } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown, ArrowRight, Clock, X, Search, GitBranch } from 'lucide-react'

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtMonth = (iso) => {
  if (!iso) return '—'
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  } catch {
    return iso.slice(0, 7)
  }
}

const fmtCurrency = (v) =>
  !v        ? '—'
  : v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B`
  : v >= 1e6 ? `$${(v / 1e6).toFixed(0)}M`
  : `$${v.toLocaleString()}`

// ── Type tag colors (text only — no pill background) ─────────────────────────

const TYPE_STYLE = {
  'MSO (Cable)':                   '#1d4ed8',
  'MSO / DBS':                     '#1d4ed8',
  'MNO (Wireless)':                '#6d28d9',
  'MNO / ILEC':                    '#6d28d9',
  'Pure MNO':                      '#6d28d9',
  'ILEC / Fiber':                  '#0a6640',
  'ILEC / DSL':                    '#0a6640',
  'CLEC / Fiber':                  '#0f766e',
  'Pure Fiber (FTTH)':             '#047857',
  'Fixed Wireless':                '#92400e',
  'MVNO (Prepaid)':                '#be185d',
  'Enterprise Fiber / Carrier':    '#3730a3',
  'SaaS / Software':               '#854d0e',
  'DBS / Satellite TV':            '#1e40af',
  'DBS':                           '#1e40af',
  'Satellite Broadband':           '#0369a1',
  'Infrastructure Private Equity': '#6d28d9',
  'Fiber Infrastructure REIT':     '#065f46',
  'Fiber ISP (MDU/HOA)':           '#047857',
  'Streaming / MVPD Platform':     '#be185d',
}

// ── StatusPill ───────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  'Completed':                   { dot: '#009d8c', bg: '#d6f8f4', text: '#007a6e', short: 'Completed' },
  'Completing':                  { dot: '#0fb8a8', bg: '#d6f8f4', text: '#0a8a7e', short: 'Completing' },
  'Pending / Regulatory Review': { dot: '#D97706', bg: '#FEF3C7', text: '#92400e', short: 'In Review' },
  'Rumored / In Discussions':    { dot: '#5872E0', bg: '#e6eafe', text: '#3f56c0', short: 'Rumored' },
  'Terminated':                  { dot: '#DC2626', bg: '#FEE2E2', text: '#b91c1c', short: 'Terminated' },
}

function StatusPill({ status, size = 'sm' }) {
  const s = STATUS_CONFIG[status] || { dot: '#86868b', bg: '#f3f4f6', text: '#6e6e73', short: status }
  const isLg = size === 'lg'

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: isLg ? 6 : 5,
      padding: isLg ? '5px 10px' : '3px 8px',
      borderRadius: 20,
      background: s.bg,
      fontSize: isLg ? 13 : 12,
      fontWeight: isLg ? 600 : 500,
      color: s.text,
      whiteSpace: 'nowrap',
      letterSpacing: '-0.005em',
    }}>
      <span style={{
        width: isLg ? 7 : 6,
        height: isLg ? 7 : 6,
        borderRadius: '50%',
        background: s.dot,
        flexShrink: 0,
      }} />
      {isLg ? status : s.short}
    </span>
  )
}

// ── DateIndicator ────────────────────────────────────────────────────────────

function DateCell({ deal }) {
  const isCompleted = deal.status === 'Completed' || deal.status === 'Completing'
  const isTerminated = deal.status === 'Terminated'
  const label = fmtMonth(deal.date)

  if (isCompleted) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#424245', fontSize: 13 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: '#009d8c', flexShrink: 0,
        }} />
        {label}
      </span>
    )
  }
  if (isTerminated) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#DC2626', fontSize: 13 }}>
        <X size={12} style={{ flexShrink: 0 }} />
        {label}
      </span>
    )
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#D97706', fontSize: 13 }}>
      <Clock size={12} style={{ flexShrink: 0 }} />
      {label}
    </span>
  )
}

// ── TypeTag ──────────────────────────────────────────────────────────────────

function TypeTag({ type }) {
  const color = TYPE_STYLE[type] || '#6e6e73'
  return (
    <span style={{
      display: 'block',
      fontSize: 12,
      fontWeight: 500,
      color,
      marginTop: 2,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }}>
      {type}
    </span>
  )
}

// ── SortIcon ─────────────────────────────────────────────────────────────────

function SortIcon({ col, sort }) {
  if (sort.col !== col) return <ArrowUpDown size={11} style={{ color: '#aeaeb2', marginLeft: 3, flexShrink: 0 }} />
  return sort.dir === 'asc'
    ? <ArrowUp size={11} style={{ color: '#2d3068', marginLeft: 3, flexShrink: 0 }} />
    : <ArrowDown size={11} style={{ color: '#2d3068', marginLeft: 3, flexShrink: 0 }} />
}

// ── Column layout ────────────────────────────────────────────────────────────

const GRID = '110px 1.4fr 18px 1.4fr 130px 100px 130px'

const S = {
  wrapper: {
    flex: 1,
    overflow: 'auto',
    position: 'relative',
    background: '#ffffff',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: GRID,
    minWidth: 800,
  },
  headerCell: (clickable) => ({
    display: 'flex',
    alignItems: 'center',
    padding: '12px 28px',
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#86868b',
    background: '#ffffff',
    borderBottom: '1px solid rgba(0,0,0,0.08)',
    cursor: clickable ? 'pointer' : 'default',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
    zIndex: 5,
  }),
  row: (selected) => ({
    display: 'contents',
    cursor: 'pointer',
  }),
  cell: (selected, first, last) => ({
    display: 'flex',
    alignItems: 'center',
    padding: '14px 28px',
    borderBottom: '1px solid rgba(0,0,0,0.05)',
    background: selected ? '#fbeee5' : '#ffffff',
    borderLeft: first && selected ? '3px solid #955438' : first ? '3px solid transparent' : 'none',
    cursor: 'pointer',
    transition: 'background 0.1s',
    overflow: 'hidden',
    minWidth: 0,
  }),
  nameBlock: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    width: '100%',
  },
  name: {
    fontSize: 14,
    fontWeight: 540,
    color: '#1d1d1f',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    lineHeight: 1.3,
  },
  peBadge: {
    display: 'inline-block',
    fontSize: 10.5,
    fontWeight: 600,
    padding: '1px 5px',
    borderRadius: 4,
    color: '#3f56c0',
    background: '#e6eafe',
    marginTop: 3,
    width: 'fit-content',
    letterSpacing: '0.01em',
  },
}

// ── Main component ───────────────────────────────────────────────────────────

export default function DealTable({ deals, selectedId, onSelect, sort, onSort, onTrace }) {
  const [hoveredId, setHoveredId] = useState(null)

  const H = (col, label, align = 'left') => (
    <div
      key={col}
      onClick={() => onSort(col)}
      style={{
        ...S.headerCell(true),
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
      }}
    >
      {label}
      <SortIcon col={col} sort={sort} />
    </div>
  )

  return (
    <div className="scroll-area" style={S.wrapper}>
      <div style={S.grid}>
        {/* Header row */}
        {H('date', 'Date')}
        {H('acquirer.name', 'Acquirer')}
        <div style={{ ...S.headerCell(false) }} />
        {H('acquired.name', 'Target')}
        {H('dealType', 'Type')}
        <div style={{ ...S.headerCell(true, false), justifyContent: 'flex-end' }} onClick={() => onSort('dealValue')}>
          Value <SortIcon col="dealValue" sort={sort} />
        </div>
        <div style={S.headerCell(false)}>Status</div>

        {/* Data rows */}
        {deals.map(deal => {
          const selected = deal.id === selectedId
          const cell = (col) => ({
            ...S.cell(selected, col === 0, col === 6),
            ...(col === 0 ? { borderLeft: selected ? '3px solid #955438' : '3px solid transparent' } : {}),
          })

          return (
            <div
              key={deal.id}
              style={{ display: 'contents' }}
              onClick={() => onSelect(deal.id === selectedId ? null : deal.id)}
              onMouseEnter={() => setHoveredId(deal.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Date */}
              <div
                style={cell(0)}
                onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(0,0,0,0.025)' }}
                onMouseLeave={e => { if (!selected) e.currentTarget.style.background = '#ffffff' }}
              >
                <DateCell deal={deal} />
              </div>

              {/* Acquirer */}
              <div
                style={cell(1)}
                onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(0,0,0,0.025)' }}
                onMouseLeave={e => { if (!selected) e.currentTarget.style.background = '#ffffff' }}
              >
                <div style={S.nameBlock}>
                  <span style={S.name}>{deal.acquirer.name}</span>
                  <TypeTag type={deal.acquirer.type} />
                  {deal.acquirer.pe && (
                    <span style={S.peBadge}>PE</span>
                  )}
                </div>
              </div>

              {/* Arrow */}
              <div
                style={{ ...cell(2), justifyContent: 'center', padding: '14px 0' }}
                onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(0,0,0,0.025)' }}
                onMouseLeave={e => { if (!selected) e.currentTarget.style.background = '#ffffff' }}
              >
                <ArrowRight size={14} style={{ color: '#aeaeb2', flexShrink: 0 }} />
              </div>

              {/* Target */}
              <div
                style={cell(3)}
                onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(0,0,0,0.025)' }}
                onMouseLeave={e => { if (!selected) e.currentTarget.style.background = '#ffffff' }}
              >
                <div style={S.nameBlock}>
                  <span style={S.name}>{deal.acquired.name}</span>
                  <TypeTag type={deal.acquired.type} />
                  {deal.acquired.pe && (
                    <span style={S.peBadge}>PE</span>
                  )}
                </div>
              </div>

              {/* Type */}
              <div
                style={{ ...cell(4) }}
                onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(0,0,0,0.025)' }}
                onMouseLeave={e => { if (!selected) e.currentTarget.style.background = '#ffffff' }}
              >
                <span style={{ fontSize: 13, color: '#424245' }}>{deal.dealType}</span>
              </div>

              {/* Value */}
              <div
                style={{ ...cell(5), justifyContent: 'flex-end' }}
                onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(0,0,0,0.025)' }}
                onMouseLeave={e => { if (!selected) e.currentTarget.style.background = '#ffffff' }}
              >
                <span style={{
                  fontSize: 14,
                  fontWeight: 560,
                  color: '#1d1d1f',
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}>
                  {fmtCurrency(deal.dealValue)}
                </span>
              </div>

              {/* Status */}
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
            </div>
          )
        })}

        {/* Empty state — span full width using a wrapper outside the grid */}
      </div>

      {deals.length === 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '64px 0',
          color: '#aeaeb2',
          gap: 10,
        }}>
          <Search size={32} style={{ opacity: 0.3 }} />
          <span style={{ fontSize: 14 }}>No deals match your filters</span>
        </div>
      )}
    </div>
  )
}
