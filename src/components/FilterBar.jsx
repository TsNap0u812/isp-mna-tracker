import { Search, ChevronDown, X } from 'lucide-react'
import { ISP_TYPES, DEAL_TYPES, STATUSES } from '../data/deals'

const S = {
  wrap: {
    background: '#ffffff',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
    padding: '12px 28px',
    flexShrink: 0,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  searchWrap: {
    position: 'relative',
    flex: '1 1 auto',
    maxWidth: 380,
    minWidth: 180,
  },
  searchIcon: {
    position: 'absolute',
    left: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#aeaeb2',
    pointerEvents: 'none',
  },
  searchInput: {
    width: '100%',
    padding: '8px 32px 8px 32px',
    fontSize: 13,
    color: '#1d1d1f',
    background: 'rgba(0,0,0,0.04)',
    border: 'none',
    borderRadius: 8,
    outline: 'none',
    fontFamily: 'inherit',
    letterSpacing: '-0.005em',
  },
  clearBtn: {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#aeaeb2',
    display: 'flex',
    alignItems: 'center',
    padding: 0,
  },
  selectWrap: {
    position: 'relative',
    flexShrink: 0,
  },
  select: {
    appearance: 'none',
    padding: '7px 28px 7px 10px',
    fontSize: 13,
    color: '#424245',
    background: '#fbfafa',
    border: '1px solid rgba(0,0,0,0.1)',
    borderRadius: 8,
    outline: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '-0.005em',
  },
  chevron: {
    position: 'absolute',
    right: 7,
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#86868b',
    pointerEvents: 'none',
  },
  spacer: { flex: 1 },
  toggleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  toggleLabel: {
    fontSize: 13,
    color: '#6e6e73',
    whiteSpace: 'nowrap',
  },
  count: {
    fontSize: 12,
    color: '#86868b',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
}

function Select({ value, onChange, options }) {
  return (
    <div style={S.selectWrap}>
      <select value={value} onChange={e => onChange(e.target.value)} style={S.select}>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
      <span style={S.chevron}><ChevronDown size={12} /></span>
    </div>
  )
}

function IOSToggle({ checked, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 34, height: 20, borderRadius: 10,
        background: checked ? '#009d8c' : 'rgba(0,0,0,0.15)',
        border: 'none', cursor: 'pointer',
        position: 'relative', flexShrink: 0,
        transition: 'background 0.2s', padding: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3,
        left: checked ? 17 : 3,
        width: 14, height: 14, borderRadius: '50%',
        background: '#ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transition: 'left 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }} />
    </button>
  )
}

export default function FilterBar({ filters, onChange, totalCount, filteredCount }) {
  const set = (key, value) => onChange({ ...filters, [key]: value })

  return (
    <div style={S.wrap}>

      {/* Row 1: Search · ISP Type · Deal Type */}
      <div style={{ ...S.row, marginBottom: 10 }}>
        <div style={S.searchWrap}>
          <span style={S.searchIcon}><Search size={14} /></span>
          <input
            type="text"
            placeholder="Search company, PE firm, deal..."
            value={filters.search}
            onChange={e => set('search', e.target.value)}
            style={S.searchInput}
          />
          {filters.search && (
            <button onClick={() => set('search', '')} style={S.clearBtn}>
              <X size={13} />
            </button>
          )}
        </div>

        <Select value={filters.ispType}  onChange={v => set('ispType', v)}  options={ISP_TYPES} />
        <Select value={filters.dealType} onChange={v => set('dealType', v)} options={DEAL_TYPES} />
      </div>

      {/* Row 2: Status · spacer · PE toggle · count */}
      <div style={S.row}>
        <Select value={filters.status} onChange={v => set('status', v)} options={STATUSES} />

        <div style={S.spacer} />

        <div style={S.toggleWrap}>
          <IOSToggle checked={filters.peOnly} onChange={val => set('peOnly', val)} />
          <span style={S.toggleLabel}>PE-backed only</span>
        </div>

        <span style={S.count}>{filteredCount} deals</span>
      </div>

    </div>
  )
}
