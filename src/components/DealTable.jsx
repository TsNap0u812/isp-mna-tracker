import { ArrowUpDown, ArrowUp, ArrowDown, Building2, Wifi, Clock } from 'lucide-react'

const fmt = (v) =>
  !v ? '—'
  : v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B`
  : v >= 1e6 ? `$${(v / 1e6).toFixed(0)}M`
  : `$${v.toLocaleString()}`

const TYPE_COLORS = {
  'MSO (Cable)':            'bg-blue-100 text-blue-800',
  'MNO (Wireless)':         'bg-purple-100 text-purple-800',
  'ILEC / Fiber':           'bg-green-100 text-green-800',
  'CLEC / Fiber':           'bg-teal-100 text-teal-800',
  'Pure Fiber (FTTH)':      'bg-emerald-100 text-emerald-800',
  'Fixed Wireless':         'bg-orange-100 text-orange-800',
  'MVNO (Prepaid)':         'bg-pink-100 text-pink-800',
  'Enterprise Fiber / Carrier': 'bg-indigo-100 text-indigo-800',
  'SaaS / Software':        'bg-yellow-100 text-yellow-800',
}

const STATUS_COLORS = {
  'Completed':                   'bg-green-50 text-green-700 ring-1 ring-green-200',
  'Completing':                  'bg-teal-50 text-teal-700 ring-1 ring-teal-200',
  'Pending / Regulatory Review': 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  'Rumored / In Discussions':    'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
}

function TypeBadge({ type }) {
  const cls = TYPE_COLORS[type] || 'bg-gray-100 text-gray-700'
  return <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{type}</span>
}

function SortIcon({ col, sort }) {
  if (sort.col !== col) return <ArrowUpDown className="h-3.5 w-3.5 text-gray-300 inline ml-1" />
  return sort.dir === 'asc'
    ? <ArrowUp className="h-3.5 w-3.5 text-brand-600 inline ml-1" />
    : <ArrowDown className="h-3.5 w-3.5 text-brand-600 inline ml-1" />
}

export default function DealTable({ deals, selectedId, onSelect, sort, onSort }) {
  const th = (col, label) => (
    <th
      onClick={() => onSort(col)}
      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-800 select-none whitespace-nowrap"
    >
      {label}<SortIcon col={col} sort={sort} />
    </th>
  )

  return (
    <div className="overflow-auto flex-1 scrollbar-thin">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
          <tr>
            {th('date', 'Date')}
            {th('acquirer.name', 'Acquirer')}
            {th('acquired.name', 'Acquired')}
            {th('dealType', 'Type')}
            {th('dealValue', 'Value')}
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">PE Backed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {deals.map(deal => {
            const isPe = !!(deal.acquirer.pe || deal.acquired.pe)
            const isSelected = deal.id === selectedId
            return (
              <tr
                key={deal.id}
                onClick={() => onSelect(deal.id === selectedId ? null : deal.id)}
                className={`cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-brand-50 border-l-4 border-l-brand-500'
                    : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                }`}
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  {deal.status === 'Completed' || deal.status === 'Completing'
                    ? <span className="text-gray-500" title="Close date">{deal.date.slice(0, 7)}</span>
                    : <span className="inline-flex items-center gap-1 text-amber-600" title="Announced date">
                        <Clock className="h-3 w-3 shrink-0" />
                        {deal.date.slice(0, 7)}
                      </span>
                  }
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900 leading-tight">{deal.acquirer.name}</div>
                  <TypeBadge type={deal.acquirer.type} />
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900 leading-tight">{deal.acquired.name}</div>
                  <TypeBadge type={deal.acquired.type} />
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{deal.dealType}</td>
                <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{fmt(deal.dealValue)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[deal.status] || 'bg-gray-100 text-gray-600'}`}>
                    {deal.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {isPe && (
                    <span title="PE-backed party" className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-100">
                      <Building2 className="h-3 w-3 text-brand-700" />
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
          {deals.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                <Wifi className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No deals match your filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
