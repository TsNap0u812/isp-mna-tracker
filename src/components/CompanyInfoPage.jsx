import { useState, useMemo } from 'react'
import { Building2, MapPin, Globe, Search, ExternalLink } from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_FILTERS = [
  { id: 'pe',        label: 'PE Firms' },
  { id: 'mso',       label: 'Cable (MSO)' },
  { id: 'mno',       label: 'Wireless (MNO)' },
  { id: 'fiber',     label: 'Fiber / ILEC' },
  { id: 'satellite', label: 'Satellite' },
]

const STATUS_BADGE = {
  'Completed':                   'bg-green-100 text-green-800',
  'Completing':                  'bg-teal-100 text-teal-800',
  'Pending / Regulatory Review': 'bg-amber-100 text-amber-800',
  'Rumored / In Discussions':    'bg-purple-100 text-purple-800',
  'Terminated':                  'bg-red-100 text-red-800',
}

const fmt = (v) =>
  !v ? null
  : v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B`
  : v >= 1e6 ? `$${(v / 1e6).toFixed(0)}M`
  : `$${v.toLocaleString()}`

// ── ISP type matchers ─────────────────────────────────────────────────────────

const ISP_MATCH = {
  mso:       t => !!t && t.startsWith('MSO'),
  mno:       t => !!t && t.startsWith('MNO'),
  fiber:     t => !!t && (t.startsWith('ILEC') || t.startsWith('CLEC') ||
                          t === 'Pure Fiber (FTTH)' || t === 'Fixed Wireless' ||
                          t === 'Fiber Infrastructure REIT' || t === 'Enterprise Fiber / Carrier' ||
                          t === 'Fiber ISP (MDU/HOA)'),
  satellite: t => !!t && (t.includes('Satellite') || t.startsWith('DBS')),
}

// ── Data builders ─────────────────────────────────────────────────────────────

function buildPEDirectory(deals) {
  const map = new Map()

  deals.forEach(d => {
    const add = (pe, role) => {
      if (!pe?.firm) return
      if (!map.has(pe.firm)) {
        map.set(pe.firm, {
          ...pe,
          primaryFunds: pe.primaryFunds ?? [],
          otherTelecomPortfolio: pe.otherTelecomPortfolio ?? [],
          dealRefs: [],
        })
      }
      const e = map.get(pe.firm)
      // Keep richest data across appearances
      if (!e.firmType && pe.firmType)                                         e.firmType = pe.firmType
      if ((!e.aum || e.aum === 'N/A') && pe.aum && pe.aum !== 'N/A')         e.aum = pe.aum
      if (!e.headquarters && pe.headquarters)                                  e.headquarters = pe.headquarters
      if (!e.website && pe.website)                                            e.website = pe.website
      if ((pe.primaryFunds?.length ?? 0) > e.primaryFunds.length)             e.primaryFunds = pe.primaryFunds
      if ((pe.otherTelecomPortfolio?.length ?? 0) > e.otherTelecomPortfolio.length)
                                                                               e.otherTelecomPortfolio = pe.otherTelecomPortfolio
      // Deduplicate deal refs
      if (!e.dealRefs.some(r => r.id === d.id && r.role === role)) {
        e.dealRefs.push({
          id: d.id, date: d.date, role,
          acquirer: d.acquirer.name, acquired: d.acquired.name,
          dealValue: d.dealValue, dealType: d.dealType, status: d.status,
        })
      }
    }

    add(d.acquirer?.pe, 'Backed acquirer')
    add(d.acquired?.pe,  'Backed target')
  })

  return [...map.values()].sort((a, b) => a.firm.localeCompare(b.firm))
}

function buildCompanyDirectory(deals, filterId) {
  const match = ISP_MATCH[filterId] || (() => false)
  const map = new Map()

  deals.forEach(d => {
    const add = (co, role, counterparty) => {
      if (!co?.name || !match(co.type)) return
      if (!map.has(co.name)) {
        map.set(co.name, { name: co.name, type: co.type, ticker: co.ticker, dealRefs: [] })
      }
      map.get(co.name).dealRefs.push({
        id: d.id, date: d.date, role, counterparty,
        dealValue: d.dealValue, dealType: d.dealType, status: d.status,
      })
    }
    add(d.acquirer, 'Acquirer', d.acquired.name)
    add(d.acquired,  'Target',   d.acquirer.name)
  })

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

// ── PE Firm Card ──────────────────────────────────────────────────────────────

function PECard({ firm }) {
  const dealRefs   = [...firm.dealRefs].sort((a, b) => new Date(b.date) - new Date(a.date))
  const portfolio  = (firm.otherTelecomPortfolio ?? []).filter(Boolean)
  const hasWebsite = firm.website && firm.website !== 'null'

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">

      {/* Header */}
      <div className="bg-brand-700 px-5 py-4">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {firm.firmType && (
            <span className="text-xs bg-brand-600 text-brand-100 px-2 py-0.5 rounded-full font-medium">
              {firm.firmType}
            </span>
          )}
          {firm.aum && firm.aum !== 'N/A' && (
            <span className="text-xs bg-brand-800 text-brand-200 px-2 py-0.5 rounded-full font-medium">
              {firm.aum} AUM
            </span>
          )}
        </div>
        <h3 className="text-white font-bold text-base leading-snug">{firm.firm}</h3>
      </div>

      {/* Body */}
      <div className="px-5 py-4 flex flex-col gap-3.5 flex-1">

        {/* HQ + Website */}
        {(firm.headquarters || hasWebsite) && (
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {firm.headquarters && (
              <span className="flex items-center gap-1.5 text-sm text-gray-500">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                {firm.headquarters}
              </span>
            )}
            {hasWebsite && (
              <a
                href={`https://${firm.website.replace(/^https?:\/\//, '')}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-brand-600 hover:underline"
              >
                <Globe className="h-3.5 w-3.5 shrink-0" />
                {firm.website}
                <ExternalLink className="h-3 w-3 opacity-60" />
              </a>
            )}
          </div>
        )}

        {/* Primary Funds */}
        {(firm.primaryFunds?.length ?? 0) > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
              Primary Funds
            </p>
            <div className="flex flex-wrap gap-1">
              {firm.primaryFunds.map(f => (
                <span key={f} className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">{f}</span>
              ))}
            </div>
          </div>
        )}

        {/* Telecom Portfolio */}
        {portfolio.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
              Telecom Portfolio
            </p>
            <div className="flex flex-wrap gap-1">
              {portfolio.map(p => (
                <span key={p} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 rounded px-2 py-0.5">{p}</span>
              ))}
            </div>
          </div>
        )}

        {/* Tracked Deals */}
        {dealRefs.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
              Tracked Deals ({dealRefs.length})
            </p>
            <div className="space-y-2">
              {dealRefs.map((ref, i) => (
                <div key={`${ref.id}-${i}`} className="bg-gray-50 rounded-lg px-3 py-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={`px-1.5 py-0.5 rounded font-medium ${
                      ref.role === 'Backed acquirer'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {ref.role}
                    </span>
                    <span className="text-gray-400 tabular-nums">{ref.date.slice(0, 7)}</span>
                  </div>
                  <div
                    className="text-gray-800 font-medium leading-tight truncate"
                    title={`${ref.acquirer} → ${ref.acquired}`}
                  >
                    {ref.acquirer} <span className="text-gray-400 mx-0.5">→</span> {ref.acquired}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {fmt(ref.dealValue) && (
                      <span className="text-gray-600 font-semibold">{fmt(ref.dealValue)}</span>
                    )}
                    <span className={`px-1.5 py-0 rounded font-medium ${STATUS_BADGE[ref.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {ref.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ── Company Card (non-PE) ─────────────────────────────────────────────────────

function CompanyCard({ company }) {
  const dealRefs = [...company.dealRefs].sort((a, b) => new Date(b.date) - new Date(a.date))

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-gray-900 text-base leading-snug">{company.name}</h3>
          {company.ticker && (
            <span className="text-xs font-mono text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 shrink-0">
              {company.ticker}
            </span>
          )}
        </div>
        <span className="inline-block mt-1.5 text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 font-medium">
          {company.type}
        </span>
      </div>
      <div className="px-5 py-3 space-y-2.5">
        {dealRefs.map((ref, i) => (
          <div key={`${ref.id}-${i}`} className="text-xs pb-2.5 border-b border-gray-50 last:border-0 last:pb-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <span className={`px-1.5 py-0.5 rounded font-medium ${
                ref.role === 'Acquirer' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
              }`}>{ref.role}</span>
              <span className="text-gray-400">{ref.date.slice(0, 7)}</span>
              {fmt(ref.dealValue) && (
                <span className="text-gray-600 font-semibold">{fmt(ref.dealValue)}</span>
              )}
              <span className={`px-1.5 py-0 rounded font-medium ${STATUS_BADGE[ref.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {ref.status}
              </span>
            </div>
            <div className="text-gray-600 pl-0.5 truncate" title={ref.counterparty}>
              {ref.role === 'Acquirer' ? `Acquired: ` : `Acquired by: `}
              <span className="text-gray-800 font-medium">{ref.counterparty}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CompanyInfoPage({ deals }) {
  const [activeFilter, setActiveFilter] = useState('pe')
  const [search, setSearch]             = useState('')

  const peDirectory = useMemo(() => buildPEDirectory(deals), [deals])

  const companyDirs = useMemo(() =>
    Object.fromEntries(
      TYPE_FILTERS
        .filter(f => f.id !== 'pe')
        .map(f => [f.id, buildCompanyDirectory(deals, f.id)])
    ),
  [deals])

  const filterCounts = useMemo(() => ({
    pe: peDirectory.length,
    ...Object.fromEntries(Object.entries(companyDirs).map(([k, v]) => [k, v.length])),
  }), [peDirectory, companyDirs])

  const displayList = useMemo(() => {
    const raw = activeFilter === 'pe' ? peDirectory : (companyDirs[activeFilter] ?? [])
    if (!search.trim()) return raw
    const q = search.toLowerCase()
    return raw.filter(item => (item.firm ?? item.name ?? '').toLowerCase().includes(q))
  }, [activeFilter, peDirectory, companyDirs, search])

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">

      {/* Filter / search bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex flex-wrap items-center gap-3 shrink-0">

        {/* Type pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {TYPE_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => { setActiveFilter(f.id); setSearch('') }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeFilter === f.id
                  ? 'bg-brand-700 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
              <span className={`text-xs rounded-full px-1.5 py-0 leading-5 ${
                activeFilter === f.id ? 'bg-brand-600 text-brand-100' : 'bg-gray-200 text-gray-500'
              }`}>
                {filterCounts[f.id] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Search + count */}
        <div className="flex items-center gap-2 ml-auto">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={activeFilter === 'pe' ? 'Search PE firms…' : 'Search companies…'}
              className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-400 w-52"
            />
          </div>
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {displayList.length} {activeFilter === 'pe' ? 'firms' : 'companies'}
          </span>
        </div>
      </div>

      {/* Card grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {displayList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Building2 className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">No entries found.</p>
          </div>
        ) : activeFilter === 'pe' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {displayList.map(firm => <PECard key={firm.firm} firm={firm} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayList.map(co => <CompanyCard key={co.name} company={co} />)}
          </div>
        )}
      </div>

    </div>
  )
}
