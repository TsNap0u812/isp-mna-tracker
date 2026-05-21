import { useState, useMemo } from 'react'
import { Wifi, RefreshCw } from 'lucide-react'
import { deals as staticDeals } from './data/deals'
import FilterBar from './components/FilterBar'
import DealTable from './components/DealTable'
import DealDetailPanel from './components/DealDetailPanel'
import RefreshModal from './components/RefreshModal'
import DealForm from './components/DealForm'
import { useLocalDeals } from './hooks/useLocalDeals'

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

export default function App() {
  const { localDeals, addDeal } = useLocalDeals()

  // Merge static + user-added deals (user-added shown at top of their date group)
  const allDeals = useMemo(() => [...localDeals, ...staticDeals], [localDeals])

  const [filters, setFilters]     = useState(DEFAULT_FILTERS)
  const [selectedId, setSelectedId] = useState(null)
  const [sort, setSort]           = useState({ col: 'date', dir: 'desc' })

  // Refresh modal state
  const [refreshState, setRefreshState] = useState('idle') // idle | loading | results | error
  const [refreshData, setRefreshData]   = useState(null)
  const [refreshError, setRefreshError] = useState(null)

  // Add-deal form state
  const [dealFormData, setDealFormData] = useState(null) // null = closed; object = pre-fill

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
    // Pre-fill form from the news headline
    const words = newsItem.title.split(/\s+/)
    setDealFormData({
      date: newsItem.pubDate ? newsItem.pubDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
      notes: `Source: ${newsItem.link || newsItem.sourceName}\n\n${newsItem.description || ''}`.trim(),
    })
  }

  const handleSaveDeal = (deal) => {
    addDeal(deal)
    setDealFormData(null)
    setRefreshState('idle') // close refresh modal too
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top nav */}
      <header className="bg-brand-700 text-white px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Wifi className="h-5 w-5 text-brand-200" />
          <span className="font-bold text-lg tracking-tight">ISP M&A Tracker</span>
          <span className="text-brand-300 text-sm hidden sm:block">· Broadband, Cable & Wireless Deal Intelligence</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-brand-300 text-xs">
            {allDeals.length} deals tracked
            {localDeals.length > 0 && <span className="ml-1 text-brand-400">({localDeals.length} added by you)</span>}
          </span>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 text-xs bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshState === 'loading' ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>
      </header>

      {/* Filter bar */}
      <FilterBar
        filters={filters}
        onChange={setFilters}
        totalCount={allDeals.length}
        filteredCount={filtered.length}
      />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <DealTable
          deals={filtered}
          selectedId={selectedId}
          onSelect={setSelectedId}
          sort={sort}
          onSort={handleSort}
        />
        {selectedDeal && (
          <DealDetailPanel deal={selectedDeal} onClose={() => setSelectedId(null)} />
        )}
      </div>

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
