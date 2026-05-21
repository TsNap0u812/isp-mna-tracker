import { useState, useMemo } from 'react'
import { Wifi, RefreshCw } from 'lucide-react'
import { deals } from './data/deals'
import FilterBar from './components/FilterBar'
import DealTable from './components/DealTable'
import DealDetailPanel from './components/DealDetailPanel'

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
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [selectedId, setSelectedId] = useState(null)
  const [sort, setSort] = useState({ col: 'date', dir: 'desc' })

  const filtered = useMemo(() => {
    let result = [...deals]

    if (filters.search) {
      const q = filters.search.toLowerCase()
      result = result.filter(d =>
        d.acquirer.name.toLowerCase().includes(q) ||
        d.acquired.name.toLowerCase().includes(q) ||
        d.acquirer.pe?.firm?.toLowerCase().includes(q) ||
        d.acquired.pe?.firm?.toLowerCase().includes(q) ||
        d.reason?.toLowerCase().includes(q) ||
        d.notes?.toLowerCase().includes(q)
      )
    }

    if (filters.ispType !== 'All Types') {
      result = result.filter(d =>
        d.acquirer.type === filters.ispType || d.acquired.type === filters.ispType
      )
    }

    if (filters.dealType !== 'All Deal Types') {
      result = result.filter(d => d.dealType === filters.dealType)
    }

    if (filters.status !== 'All Statuses') {
      result = result.filter(d => d.status === filters.status)
    }

    if (filters.peOnly) {
      result = result.filter(d => d.acquirer.pe || d.acquired.pe)
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
  }, [filters, sort])

  const handleSort = (col) => {
    setSort(prev => ({ col, dir: prev.col === col && prev.dir === 'asc' ? 'desc' : 'asc' }))
  }

  const selectedDeal = filtered.find(d => d.id === selectedId) ?? deals.find(d => d.id === selectedId)

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
          <span className="text-brand-300 text-xs">{deals.length} deals tracked</span>
          <button
            title="Run npm run refresh-data to fetch new deals"
            className="flex items-center gap-1.5 text-xs bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Data
          </button>
        </div>
      </header>

      {/* Filter bar */}
      <FilterBar
        filters={filters}
        onChange={setFilters}
        totalCount={deals.length}
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
    </div>
  )
}
