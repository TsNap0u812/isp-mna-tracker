import { useState, useMemo } from 'react'
import { Wifi, List, BarChart2, Building2, Wallet, RefreshCw, Plus, GitBranch } from 'lucide-react'
import { legacyDeals } from './data/db'

const staticDeals = legacyDeals()
import FilterBar from './components/FilterBar'
import DealTable from './components/DealTable'
import DealDetailPanel from './components/DealDetailPanel'
import RefreshModal from './components/RefreshModal'
import DealForm from './components/DealForm'
import AnalyticsPage from './components/AnalyticsPage'
import CompanyInfoPage from './components/CompanyInfoPage'
import FundMgmtPage from './components/FundMgmtPage'
import EvolutionsPage from './components/EvolutionsPage'
import { useLocalDeals } from './hooks/useLocalDeals'

const TABS = [
  { id: 'tracker',      label: 'Deal Tracker',  icon: List },
  { id: 'analytics',   label: 'Analytics',     icon: BarChart2 },
  { id: 'company-info', label: 'Companies',    icon: Building2 },
  { id: 'fund-mgmt',   label: 'Fund Mgmt',     icon: Wallet },
  { id: 'evolutions',  label: 'Evolutions',    icon: GitBranch },
]

const TAB_SUBTITLES = {
  tracker:        null,
  analytics:      'Charts & breakdowns',
  'fund-mgmt':    'PE fund dry powder, sector lean & saturation',
  'company-info': 'PE directory & ISP types',
  evolutions:     'Trace how any ISP entity has grown through M&A',
}

const DEFAULT_FILTERS = {
  search: '',
  ispType: 'All Types',
  dealType: 'All Deal Types',
  status: 'All Statuses',
  peOnly: false,
}

function getNestedVal(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj)
}

// ── Styles ──────────────────────────────────────────────────────────────────

const S = {
  root: {
    height: '100vh',
    display: 'flex',
    overflow: 'hidden',
    background: '#f5f5f7',
  },

  // Sidebar
  sidebar: {
    width: 232,
    minWidth: 232,
    background: 'linear-gradient(180deg, #2d3068 0%, #25285a 100%)',
    display: 'flex',
    flexDirection: 'column',
    padding: '14px 12px',
    overflow: 'hidden',
  },
  logoArea: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '6px 8px 16px',
  },
  logoIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    background: 'linear-gradient(135deg, #955438, #B8744F)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  logoText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  logoTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: '-0.01em',
    lineHeight: 1.2,
  },
  logoSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: '0.01em',
    lineHeight: 1.2,
  },
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: 'rgba(255,255,255,0.45)',
    padding: '12px 8px 6px',
  },
  navBtn: (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '7px 10px',
    borderRadius: 7,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    color: active ? '#ffffff' : 'rgba(255,255,255,0.78)',
    background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
    textAlign: 'left',
    transition: 'background 0.15s, color 0.15s',
    marginBottom: 2,
  }),
  navBtnIcon: {
    opacity: 0.85,
    flexShrink: 0,
  },
  quickFilterBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '5px 10px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    background: 'transparent',
    transition: 'background 0.12s',
    marginBottom: 1,
  },
  quickFilterLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.78)',
  },
  quickFilterCount: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    fontVariantNumeric: 'tabular-nums',
    minWidth: 18,
    textAlign: 'right',
  },
  spacer: { flex: 1 },
  sidebarFooter: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '8px 10px',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#00DEC8',
    boxShadow: '0 0 6px rgba(0,222,200,0.7)',
    flexShrink: 0,
  },
  liveText: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.5)',
  },

  // Main area
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: '#ffffff',
  },

  // Toolbar
  toolbar: {
    height: 56,
    minHeight: 56,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 28px',
    backdropFilter: 'blur(20px) saturate(180%)',
    background: 'rgba(255,255,255,0.85)',
    borderBottom: '1px solid rgba(0,0,0,0.08)',
    flexShrink: 0,
    zIndex: 10,
  },
  toolbarLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  toolbarTitle: {
    fontSize: 17,
    fontWeight: 600,
    color: '#1d1d1f',
    letterSpacing: '-0.01em',
    lineHeight: 1.2,
  },
  toolbarSub: {
    fontSize: 12,
    color: '#86868b',
    lineHeight: 1.2,
  },
  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid rgba(0,0,0,0.12)',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 13,
    color: '#424245',
    fontWeight: 500,
    transition: 'background 0.12s',
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px',
    borderRadius: 8,
    border: 'none',
    background: 'linear-gradient(135deg, #955438, #B8744F)',
    cursor: 'pointer',
    fontSize: 13,
    color: '#ffffff',
    fontWeight: 600,
    transition: 'opacity 0.12s',
  },

  // Content area
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  tableRow: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
}

function QuickFilterDot({ color }) {
  return (
    <span style={{
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: color,
      flexShrink: 0,
      display: 'inline-block',
    }} />
  )
}

export default function App() {
  const { localDeals, addDeal } = useLocalDeals()
  const [activeTab, setActiveTab] = useState('tracker')

  const allDeals = useMemo(() => [...localDeals, ...staticDeals], [localDeals])

  const [filters, setFilters]       = useState(DEFAULT_FILTERS)
  const [selectedId, setSelectedId] = useState(null)
  const [sort, setSort]             = useState({ col: 'date', dir: 'desc' })

  const [refreshState, setRefreshState] = useState('idle')
  const [refreshData, setRefreshData]   = useState(null)
  const [refreshError, setRefreshError] = useState(null)

  const [dealFormData, setDealFormData] = useState(null)
  const [evolutionSeed, setEvolutionSeed] = useState(null)

  const filtered = useMemo(() => {
    let result = [...allDeals]

    if (filters.search) {
      const q = filters.search.toLowerCase()
      result = result.filter(d =>
        d.acquirer?.name?.toLowerCase().includes(q) ||
        d.acquired?.name?.toLowerCase().includes(q) ||
        d.acquirer?.pe?.firm?.toLowerCase().includes(q) ||
        d.acquired?.pe?.firm?.toLowerCase().includes(q) ||
        d.reason?.toLowerCase().includes(q) ||
        d.notes?.toLowerCase().includes(q)
      )
    }

    if (filters.ispType !== 'All Types') {
      result = result.filter(d =>
        d.acquirer?.type === filters.ispType || d.acquired?.type === filters.ispType
      )
    }

    if (filters.dealType !== 'All Deal Types') {
      result = result.filter(d => d.dealType === filters.dealType)
    }

    if (filters.status !== 'All Statuses') {
      result = result.filter(d => d.status === filters.status)
    }

    if (filters.peOnly) {
      result = result.filter(d => d.acquirer?.pe || d.acquired?.pe)
    }

    result.sort((a, b) => {
      let av = getNestedVal(a, sort.col)
      let bv = getNestedVal(b, sort.col)
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      if (av < bv) return sort.dir === 'asc' ? -1 : 1
      if (av > bv) return sort.dir === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [allDeals, filters, sort])

  const handleSort = (col) =>
    setSort(prev => ({ col, dir: prev.col === col && prev.dir === 'asc' ? 'desc' : 'asc' }))

  const selectedDeal = filtered.find(d => d.id === selectedId) ?? allDeals.find(d => d.id === selectedId)

  // Quick filter counts
  const counts = useMemo(() => {
    const completed   = allDeals.filter(d => d.status === 'Completed' || d.status === 'Completing').length
    const review      = allDeals.filter(d => d.status === 'Pending / Regulatory Review').length
    const rumored     = allDeals.filter(d => d.status === 'Rumored / In Discussions').length
    const terminated  = allDeals.filter(d => d.status === 'Terminated').length
    const pe          = allDeals.filter(d => d.acquirer?.pe || d.acquired?.pe).length
    return { all: allDeals.length, completed, review, rumored, terminated, pe }
  }, [allDeals])

  // ── Refresh ────────────────────────────────────────────────────────────────
  const handleRefresh = async () => {
    setRefreshState('loading')
    setRefreshData(null)
    setRefreshError(null)
    try {
      const res = await fetch('/api/refresh')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setRefreshData(data)
      setRefreshState('results')
    } catch (e) {
      setRefreshError(e.message)
      setRefreshState('error')
    }
  }

  const handleCreateDeal = (newsItem) => {
    const words = newsItem.title.split(/\s+/)
    setDealFormData({
      date: newsItem.pubDate ? newsItem.pubDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
      notes: `Source: ${newsItem.link || newsItem.sourceName}\n\n${newsItem.description || ''}`.trim(),
    })
  }

  const handleSaveDeal = (deal) => {
    addDeal(deal)
    setDealFormData(null)
    setRefreshState('idle')
  }

  const handleTrace = (deal) => {
    setEvolutionSeed(deal.acquirer?.name ?? null)
    setActiveTab('evolutions')
  }

  // Quick filter helpers
  const applyQuickFilter = (statusFilter, peOnly = false) => {
    setActiveTab('tracker')
    setFilters({ ...DEFAULT_FILTERS, status: statusFilter, peOnly })
    setSelectedId(null)
  }

  const QUICK_FILTERS = [
    {
      label: 'All deals',
      color: '#ffffff',
      count: counts.all,
      onClick: () => { setActiveTab('tracker'); setFilters(DEFAULT_FILTERS); setSelectedId(null) },
    },
    {
      label: 'Completed',
      color: '#00DEC8',
      count: counts.completed,
      onClick: () => applyQuickFilter('Completed'),
    },
    {
      label: 'In review',
      color: '#E8B194',
      count: counts.review,
      onClick: () => applyQuickFilter('Pending / Regulatory Review'),
    },
    {
      label: 'Rumored',
      color: '#5872E0',
      count: counts.rumored,
      onClick: () => applyQuickFilter('Rumored / In Discussions'),
    },
    {
      label: 'Terminated',
      color: '#e88090',
      count: counts.terminated,
      onClick: () => applyQuickFilter('Terminated'),
    },
    {
      label: 'PE-backed',
      color: '#5872E0',
      count: counts.pe,
      onClick: () => { setActiveTab('tracker'); setFilters({ ...DEFAULT_FILTERS, peOnly: true }); setSelectedId(null) },
    },
  ]

  const activeTabObj = TABS.find(t => t.id === activeTab)
  const toolbarSub = activeTab === 'tracker'
    ? `${allDeals.length} deals tracked${localDeals.length > 0 ? ` · ${localDeals.length} added by you` : ''}`
    : TAB_SUBTITLES[activeTab]

  return (
    <div style={S.root}>
      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside style={S.sidebar}>
        {/* Logo */}
        <div style={S.logoArea}>
          <div style={S.logoIcon}>
            <Wifi size={14} color="#ffffff" />
          </div>
          <div style={S.logoText}>
            <span style={S.logoTitle}>ISP M&A</span>
            <span style={S.logoSub}>Deal Intelligence</span>
          </div>
        </div>

        {/* Primary nav */}
        <div style={S.sectionLabel}>Workspace</div>
        {TABS.map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={S.navBtn(active)}
            >
              <Icon size={14} style={S.navBtnIcon} />
              {tab.label}
            </button>
          )
        })}

        {/* Quick filters */}
        <div style={S.sectionLabel}>Quick filters</div>
        {QUICK_FILTERS.map(qf => (
          <button
            key={qf.label}
            onClick={qf.onClick}
            style={S.quickFilterBtn}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={S.quickFilterLeft}>
              <QuickFilterDot color={qf.color} />
              {qf.label}
            </span>
            <span style={S.quickFilterCount}>{qf.count}</span>
          </button>
        ))}

        <div style={S.spacer} />

        {/* Footer */}
        <div style={S.sidebarFooter}>
          <span style={S.liveDot} />
          <span style={S.liveText}>Live · updated today</span>
        </div>
      </aside>

      {/* ── Main area ────────────────────────────────────────────────── */}
      <main style={S.main}>
        {/* Toolbar */}
        <div style={S.toolbar}>
          <div style={S.toolbarLeft}>
            <span style={S.toolbarTitle}>{activeTabObj?.label}</span>
            {toolbarSub && <span style={S.toolbarSub}>{toolbarSub}</span>}
          </div>
          <div style={S.toolbarRight}>
            {activeTab === 'tracker' && (
              <button
                onClick={handleRefresh}
                style={S.refreshBtn}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <RefreshCw
                  size={13}
                  style={refreshState === 'loading' ? { animation: 'spin 0.8s linear infinite' } : undefined}
                />
                Refresh feed
              </button>
            )}
            <button
              onClick={() => setDealFormData({})}
              style={S.addBtn}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <Plus size={13} />
              Add deal
            </button>
          </div>
        </div>

        {/* Tab content */}
        <div style={S.content}>
          {activeTab === 'tracker' && (
            <>
              <FilterBar
                filters={filters}
                onChange={setFilters}
                totalCount={allDeals.length}
                filteredCount={filtered.length}
              />
              <div style={S.tableRow}>
                <DealTable
                  deals={filtered}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  sort={sort}
                  onSort={handleSort}
                  onTrace={handleTrace}
                />
                {selectedDeal && (
                  <DealDetailPanel deal={selectedDeal} onClose={() => setSelectedId(null)} />
                )}
              </div>
            </>
          )}

          {activeTab === 'analytics' && (
            <AnalyticsPage
              deals={allDeals}
              onNavigateToDeal={id => { setActiveTab('tracker'); setSelectedId(id) }}
            />
          )}

          {activeTab === 'fund-mgmt' && (
            <FundMgmtPage
              deals={allDeals}
              onNavigateToDeal={id => { setActiveTab('tracker'); setSelectedId(id) }}
            />
          )}

          {activeTab === 'company-info' && (
            <CompanyInfoPage
              deals={allDeals}
              onNavigateToDeal={id => { setActiveTab('tracker'); setSelectedId(id) }}
            />
          )}

          {activeTab === 'evolutions' && (
            <EvolutionsPage
              deals={allDeals}
              seed={evolutionSeed}
              onSeedConsumed={() => setEvolutionSeed(null)}
              onNavigateToDeal={id => { setActiveTab('tracker'); setSelectedId(id) }}
            />
          )}
        </div>
      </main>

      {/* Refresh modal */}
      {refreshState !== 'idle' && (
        <RefreshModal
          state={refreshState}
          data={refreshData}
          error={refreshError}
          onClose={() => setRefreshState('idle')}
          onCreateDeal={handleCreateDeal}
        />
      )}

      {/* Add deal form */}
      {dealFormData !== null && (
        <DealForm
          initial={dealFormData}
          sourceUrl={dealFormData?.notes?.match(/Source: (https?:\/\/\S+)/)?.[1]}
          onSave={handleSaveDeal}
          onClose={() => setDealFormData(null)}
        />
      )}
    </div>
  )
}
