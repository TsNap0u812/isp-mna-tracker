import { Search, X } from 'lucide-react'
import { ISP_TYPES, DEAL_TYPES, STATUSES } from '../data/deals'

export default function FilterBar({ filters, onChange, totalCount, filteredCount }) {
  const set = (key, value) => onChange({ ...filters, [key]: value })

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search company, deal, PE firm…"
            value={filters.search}
            onChange={e => set('search', e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {filters.search && (
            <button onClick={() => set('search', '')} className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* ISP Type */}
        <select
          value={filters.ispType}
          onChange={e => set('ispType', e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        >
          {ISP_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>

        {/* Deal Type */}
        <select
          value={filters.dealType}
          onChange={e => set('dealType', e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        >
          {DEAL_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>

        {/* Status */}
        <select
          value={filters.status}
          onChange={e => set('status', e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        >
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>

        {/* PE Only toggle */}
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filters.peOnly}
            onChange={e => set('peOnly', e.target.checked)}
            className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          />
          PE-backed only
        </label>
      </div>

      <div className="text-xs text-gray-400">
        Showing {filteredCount} of {totalCount} deals
      </div>
    </div>
  )
}
