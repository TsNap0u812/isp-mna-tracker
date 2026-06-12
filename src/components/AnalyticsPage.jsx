import { useMemo, useState } from 'react'
import {
  ComposedChart, BarChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts'
import { DollarSign, Activity, Layers, TrendingUp, Users, X, ExternalLink } from 'lucide-react'

// ── Color palettes ────────────────────────────────────────────────────────────

// Brand palette: Space Blue #2D3068 · Copper #E8B194→#955438 · Digital Teal #00DEC8 · Ultraviolet #5872E0
const ACQTYPE_COLORS = {
  'Private Equity':      '#5872E0',  // Ultraviolet
  'Infrastructure Fund': '#3f56c0',  // Ultraviolet deep
  'Cable MSO':           '#2D3068',  // Space Blue
  'Wireless Carrier':    '#00DEC8',  // Digital Teal
  'Fiber / ILEC':        '#B8744F',  // Copper Conduit mid
  'Satellite':           '#E8B194',  // Copper Conduit light
  'Other':               '#aeaeb2',  // Neutral
}
const ACQTYPES = Object.keys(ACQTYPE_COLORS)

// ── Co-acquirer deal splits ───────────────────────────────────────────────────
// Maps compound acquirer name → [ {name, pct, type} ]
// Capital is attributed proportionally to each party's equity stake.
// "pct" values must sum to 1.0 per entry.
const CO_ACQUIRER_SPLITS = {
  // T-Mobile JVs — all 50/50; T-Mobile acquires 50% of JV infrastructure
  'T-Mobile US + EQT Infrastructure (Lumos Networks JV)': [
    { name: 'T-Mobile US',        pct: 0.5, type: 'Wireless Carrier'    },
    { name: 'EQT Infrastructure', pct: 0.5, type: 'Infrastructure Fund' },
  ],
  'T-Mobile US + KKR': [
    { name: 'T-Mobile US', pct: 0.5, type: 'Wireless Carrier'    },
    { name: 'KKR',         pct: 0.5, type: 'Infrastructure Fund' },
  ],
  'T-Mobile US + Oak Hill Capital': [
    { name: 'T-Mobile US',    pct: 0.5, type: 'Wireless Carrier' },
    { name: 'Oak Hill Capital', pct: 0.5, type: 'Private Equity' },
  ],
  'T-Mobile US + Wren House Infrastructure Management': [
    { name: 'T-Mobile US',     pct: 0.5, type: 'Wireless Carrier'    },
    { name: 'Wren House',      pct: 0.5, type: 'Infrastructure Fund' },
  ],
  // AT&T + BlackRock GigaPower JV — "each hold ~50%"
  'GigaPower LLC (AT&T + BlackRock JV)': [
    { name: 'AT&T Inc.',              pct: 0.5, type: 'Wireless Carrier'    },
    { name: 'BlackRock Infrastructure', pct: 0.5, type: 'Infrastructure Fund' },
  ],
  // EQT + Digital Colony (Zayo) — co-equal co-lead
  'EQT Infrastructure + Digital Colony Partners (DigitalBridge)': [
    { name: 'EQT Infrastructure', pct: 0.5, type: 'Infrastructure Fund' },
    { name: 'DigitalBridge Group', pct: 0.5, type: 'Infrastructure Fund' },
  ],
  // DigitalBridge + Crestview (WOW!) — DigitalBridge led; Crestview rolled minority equity
  // exact split undisclosed — using 50/50 as neutral proxy
  'DigitalBridge Group + Crestview Partners': [
    { name: 'DigitalBridge Group', pct: 0.5, type: 'Infrastructure Fund' },
    { name: 'Crestview Partners',  pct: 0.5, type: 'Private Equity'      },
  ],
  // Socket Fiber — Oak Hill + Pamlico; split undisclosed, assume equal
  'Socket Fiber (Oak Hill Capital + Pamlico Capital)': [
    { name: 'Oak Hill Capital', pct: 0.5, type: 'Private Equity' },
    { name: 'Pamlico Capital',  pct: 0.5, type: 'Private Equity' },
  ],
  // 3-way carrier JV — "each of the three carriers holds a roughly equal stake"
  'AT&T + T-Mobile + Verizon': [
    { name: 'AT&T Inc.',              pct: 1/3, type: 'Wireless Carrier' },
    { name: 'T-Mobile US',            pct: 1/3, type: 'Wireless Carrier' },
    { name: 'Verizon Communications', pct: 1/3, type: 'Wireless Carrier' },
  ],
}

const TIER_COLORS = {
  'Mega (≥$5B)':           '#2d3068',
  'Large ($1–5B)':         '#955438',
  'Mid ($100M–1B)':        '#E8B194',
  'Bolt-on / Undisclosed': '#d1d5db',
}

const TIER_LABELS = {
  'Mega (≥$5B)':           'Mega ≥$5B',
  'Large ($1–5B)':         'Large $1–5B',
  'Mid ($100M–1B)':        'Mid $100M–1B',
  'Bolt-on / Undisclosed': 'Bolt-on',
}

const STATUS_BADGE = {
  'Completed':                   'bg-green-100 text-green-800',
  'Completing':                  'bg-teal-100 text-teal-800',
  'Pending / Regulatory Review': 'bg-amber-100 text-amber-800',
  'Rumored / In Discussions':    'bg-purple-100 text-purple-800',
  'Terminated':                  'bg-red-100 text-red-800',
}

// ── Formatters ────────────────────────────────────────────────────────────────

const fmt = v =>
  !v       ? null
  : v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B`
  : v >= 1e6 ? `$${(v / 1e6).toFixed(0)}M`
  : `$${v.toLocaleString()}`

const fmtPct = v => `${(v * 100).toFixed(0)}%`

// ── Computed field helpers ────────────────────────────────────────────────────

function acqType(deal) {
  if (deal.acquirer?.pe) {
    const ft = (deal.acquirer.pe.firmType ?? '').toLowerCase()
    return ft.includes('infrastructure') || ft.includes('infra')
      ? 'Infrastructure Fund'
      : 'Private Equity'
  }
  const t = deal.acquirer?.type ?? ''
  if (t.startsWith('MNO'))                                        return 'Wireless Carrier'
  if (t.startsWith('MSO'))                                        return 'Cable MSO'
  if (t.startsWith('ILEC') || t.startsWith('CLEC') ||
      t === 'Pure Fiber (FTTH)' || t === 'Fixed Wireless' ||
      t === 'Fiber Infrastructure REIT' ||
      t === 'Enterprise Fiber / Carrier' ||
      t === 'Fiber ISP (MDU/HOA)')                                return 'Fiber / ILEC'
  if (t.includes('Satellite') || t.startsWith('DBS'))            return 'Satellite'
  return 'Other'
}

function sizeTier(value) {
  if (!value)       return 'Bolt-on / Undisclosed'
  if (value >= 5e9) return 'Mega (≥$5B)'
  if (value >= 1e9) return 'Large ($1–5B)'
  if (value >= 1e8) return 'Mid ($100M–1B)'
  return 'Bolt-on / Undisclosed'
}

function isConvergence(deal) {
  const a = deal.acquirer?.type ?? ''
  const t = deal.acquired?.type  ?? ''
  const isMobile   = s => s.includes('MNO')
  const isWireline = s => s.startsWith('MSO') || s.startsWith('ILEC') || s.startsWith('CLEC') ||
                          s === 'Pure Fiber (FTTH)' || s.includes('Fiber') || s === 'Fixed Wireless'
  return (isMobile(a) && isWireline(t)) || (isMobile(t) && isWireline(a))
}

function toQtr(dateStr) {
  const d = new Date(dateStr)
  return `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}`
}

function cutoffDate(yearsBack) {
  const d = new Date()
  d.setFullYear(d.getFullYear() - yearsBack)
  return d
}

// ── Chart data builders ───────────────────────────────────────────────────────

function buildQuarterlyData(deals) {
  const cutoff = cutoffDate(5)
  const map = new Map()
  deals
    .filter(d => d.status !== 'Terminated' && new Date(d.date) >= cutoff)
    .forEach(d => {
      const q = toQtr(d.date)
      if (!map.has(q)) {
        const e = { quarter: q, count: 0 }
        ACQTYPES.forEach(t => { e[t] = 0 })
        map.set(q, e)
      }
      const e = map.get(q)
      e.count++
      const at = acqType(d)
      e[at] = +(e[at] + (d.dealValue ?? 0) / 1e9).toFixed(3)
    })
  return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, v]) => v)
}

function buildPipelineStages(deals) {
  const ytdStart = new Date(new Date().getFullYear(), 0, 1)
  const sum = arr => arr.reduce((s, d) => s + (d.dealValue ?? 0), 0)
  const rumored  = deals.filter(d => d.status === 'Rumored / In Discussions')
  const inReview = deals.filter(d =>
    d.status === 'Pending / Regulatory Review' || d.status === 'Completing')
  const ytdDone  = deals.filter(d =>
    d.status === 'Completed' && new Date(d.date) >= ytdStart)
  return [
    { stage: 'Rumored',                            count: rumored.length,  value: sum(rumored),  weighted: sum(rumored)  * 0.25, color: '#5872E0' },  // Ultraviolet
    { stage: 'In Review',                          count: inReview.length, value: sum(inReview), weighted: sum(inReview) * 0.90, color: '#2D3068' },  // Space Blue
    { stage: `Closed ${new Date().getFullYear()}`, count: ytdDone.length,  value: sum(ytdDone),  weighted: sum(ytdDone),         color: '#009d8c' },  // Digital Teal (dark)
  ]
}

function buildLeaderboard(deals) {
  // map: canonical party name → { name, value, count, type, matchNames }
  // matchNames = Set of raw acquirer.name strings that feed this party
  const map = new Map()

  const upsert = (canonicalName, value, type, rawAcquirerName) => {
    if (!map.has(canonicalName)) {
      map.set(canonicalName, { name: canonicalName, value: 0, count: 0, type, matchNames: new Set() })
    }
    const e = map.get(canonicalName)
    e.count++
    e.value += value
    e.matchNames.add(rawAcquirerName)
  }

  deals.filter(d => d.status !== 'Terminated').forEach(d => {
    const rawName = d.acquirer?.name
    if (!rawName) return
    const splits = CO_ACQUIRER_SPLITS[rawName]
    if (splits) {
      // Co-acquirer deal: attribute dealValue proportionally to each party
      splits.forEach(({ name: partyName, pct, type }) => {
        upsert(partyName, (d.dealValue ?? 0) * pct, type, rawName)
      })
    } else {
      // Single acquirer: attribute full value
      upsert(rawName, d.dealValue ?? 0, acqType(d), rawName)
    }
  })

  return [...map.values()]
    .sort((a, b) => b.value - a.value)
    .slice(0, 12)
    .map(d => ({ ...d, valueB: +(d.value / 1e9).toFixed(2) }))
}

function buildSizeTiers(deals) {
  const map = new Map()
  deals.filter(d => d.status !== 'Terminated').forEach(d => {
    const t = sizeTier(d.dealValue)
    if (!map.has(t)) map.set(t, { tier: t, count: 0, value: 0 })
    const e = map.get(t); e.count++; e.value += d.dealValue ?? 0
  })
  return ['Mega (≥$5B)', 'Large ($1–5B)', 'Mid ($100M–1B)', 'Bolt-on / Undisclosed'].map(t => ({
    tier: t, count: 0, value: 0, ...map.get(t), color: TIER_COLORS[t],
  }))
}

function buildPEPlatform(deals) {
  const map = new Map()
  deals.filter(d => d.status !== 'Terminated').forEach(d => {
    const addFirm = (pe, role) => {
      if (!pe?.firm) return
      if (!map.has(pe.firm)) map.set(pe.firm, { firm: pe.firm, asAcquirer: 0, asTarget: 0 })
      map.get(pe.firm)[role]++
    }
    addFirm(d.acquirer?.pe, 'asAcquirer')
    addFirm(d.acquired?.pe,  'asTarget')
  })
  return [...map.values()]
    .map(e => ({ ...e, total: e.asAcquirer + e.asTarget }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
}

function buildConvergence(deals) {
  const cutoff = cutoffDate(5)
  const map = new Map()
  deals
    .filter(d => d.status !== 'Terminated' && new Date(d.date) >= cutoff)
    .forEach(d => {
      const q = toQtr(d.date)
      if (!map.has(q)) map.set(q, { quarter: q, Convergence: 0, 'Non-convergence': 0 })
      map.get(q)[isConvergence(d) ? 'Convergence' : 'Non-convergence']++
    })
  return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, v]) => v)
}

// ── Drill-through panel ───────────────────────────────────────────────────────

function DrilldownPanel({ drilldown, onNavigate, onClose }) {
  if (!drilldown) return null
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/10"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-80 bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-100 shrink-0">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Deal Breakdown</p>
            <h3 className="font-bold text-gray-900 text-sm mt-0.5 leading-snug">{drilldown.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Deal list */}
        <div className="flex-1 overflow-y-auto">
          {drilldown.deals.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No deals for this selection.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {drilldown.deals.map(d => (
                <button
                  key={d.id}
                  onClick={() => onNavigate(d.id)}
                  className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-gray-800 leading-snug">
                      {d.acquirer?.name}
                      <span className="text-gray-400 mx-1">→</span>
                      {d.acquired?.name}
                    </p>
                    <ExternalLink className="h-3 w-3 text-gray-300 group-hover:text-indigo-400 shrink-0 mt-0.5 transition-colors" />
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-xs text-gray-400 tabular-nums">{d.date.slice(0, 7)}</span>
                    {fmt(d.dealValue) && (
                      <span className="text-xs font-semibold text-gray-600">{fmt(d.dealValue)}</span>
                    )}
                    <span className={`text-xs px-1.5 py-0 rounded font-medium ${STATUS_BADGE[d.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {d.status}
                    </span>
                  </div>
                  {d.dealType && (
                    <p className="text-xs text-gray-400 mt-0.5">{d.dealType}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-gray-100 shrink-0">
          <p className="text-xs text-gray-400">
            {drilldown.deals.length} deal{drilldown.deals.length !== 1 ? 's' : ''} · Click any row to open in Deal Tracker
          </p>
        </div>

      </div>
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KPICard({ title, value, sub, delta, icon: Icon, accent = 'text-gray-300' }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex flex-col gap-1 min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide truncate">{title}</span>
        {Icon && <Icon className={`h-4 w-4 shrink-0 ${accent}`} />}
      </div>
      <p className="text-2xl font-bold text-gray-900 leading-tight mt-1">{value}</p>
      {sub   && <p className="text-xs text-gray-500">{sub}</p>}
      {delta && (
        <p className={`text-xs font-medium ${
          delta.startsWith('+') ? 'text-green-600' : delta.startsWith('-') ? 'text-red-500' : 'text-gray-400'
        }`}>
          {delta} vs prior year
        </p>
      )}
    </div>
  )
}

function ChartCard({ title, subtitle, children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

// Custom tooltip for the quarterly chart (mixes $B bars + integer count line)
function QuarterlyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const valueItems = payload.filter(p => p.name !== 'Count' && p.value > 0)
  const countItem  = payload.find(p => p.name === 'Count')
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs min-w-[160px] pointer-events-none">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {valueItems.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 mb-0.5">
          <span className="flex items-center gap-1.5 text-gray-500">
            <span className="inline-block w-2 h-2 rounded-sm shrink-0" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-medium text-gray-800">${Number(p.value).toFixed(1)}B</span>
        </div>
      ))}
      {countItem && (
        <div className="flex items-center justify-between gap-4 mt-1.5 pt-1.5 border-t border-gray-100">
          <span className="text-gray-500">Deal count</span>
          <span className="font-semibold text-gray-800">{countItem.value}</span>
        </div>
      )}
      <p className="mt-2 text-gray-400 italic">Click bar to view deals</p>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage({ deals, onNavigateToDeal }) {
  const [drilldown, setDrilldown] = useState(null)

  const ttmStart  = useMemo(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d }, [])
  const pttmStart = useMemo(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 2); return d }, [])

  const ttmDeals  = useMemo(() =>
    deals.filter(d => new Date(d.date) >= ttmStart && d.status !== 'Terminated'),
  [deals, ttmStart])

  const pttmDeals = useMemo(() =>
    deals.filter(d => new Date(d.date) >= pttmStart && new Date(d.date) < ttmStart && d.status !== 'Terminated'),
  [deals, ttmStart, pttmStart])

  const kpi = useMemo(() => {
    const sum    = arr => arr.reduce((s, d) => s + (d.dealValue ?? 0), 0)
    const ttmV   = sum(ttmDeals)
    const pttmV  = sum(pttmDeals)
    const cntΔ   = ttmDeals.length - pttmDeals.length
    const valΔ   = ttmV - pttmV
    const pending = deals.filter(d =>
      d.status === 'Pending / Regulatory Review' ||
      d.status === 'Rumored / In Discussions'    ||
      d.status === 'Completing'
    )
    const peV     = sum(ttmDeals.filter(d => d.acquirer?.pe))
    const ttmSubs = ttmDeals.reduce((s, d) => s + (d.acquired?.subscribers ?? 0), 0)
    return {
      ttmCount:  ttmDeals.length,
      cntDelta:  cntΔ >= 0 ? `+${cntΔ}` : `${cntΔ}`,
      ttmVal:    fmt(ttmV) ?? '$0',
      valDelta:  valΔ >= 0 ? `+${fmt(valΔ)}` : `-${fmt(Math.abs(valΔ))}`,
      pipeVal:   fmt(sum(pending)) ?? '$0',
      pipeCount: pending.length,
      peShare:   fmtPct(ttmV > 0 ? peV / ttmV : 0),
      ttmSubs,
    }
  }, [deals, ttmDeals, pttmDeals])

  const qData    = useMemo(() => buildQuarterlyData(deals),  [deals])
  const pipe     = useMemo(() => buildPipelineStages(deals), [deals])
  const leader   = useMemo(() => buildLeaderboard(deals),    [deals])
  const tiers    = useMemo(() => buildSizeTiers(deals),      [deals])
  const platform = useMemo(() => buildPEPlatform(deals),     [deals])
  const conv     = useMemo(() => buildConvergence(deals),    [deals])
  const dead     = useMemo(() =>
    deals.filter(d => d.status === 'Terminated').sort((a, b) => new Date(b.date) - new Date(a.date)),
  [deals])

  const maxTier = Math.max(...tiers.map(t => t.count), 1)
  const maxPipe = Math.max(...pipe.map(s => s.count),  1)

  // ── Drill-through handlers ────────────────────────────────────────────────

  const openQuarterDrill = payload => {
    const q = payload?.activeLabel
    if (!q) return
    const cutoff = cutoffDate(5)
    const matched = deals
      .filter(d => d.status !== 'Terminated' && new Date(d.date) >= cutoff && toQtr(d.date) === q)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
    setDrilldown({ title: q, deals: matched })
  }

  const openAcquirerDrill = row => {
    if (!row) return
    // matchNames contains all raw acquirer.name strings that rolled up to this row
    // (e.g. "T-Mobile US" matchNames includes "T-Mobile US + KKR" etc.)
    const names = row.matchNames ?? new Set([row.name])
    const matched = deals
      .filter(d => d.status !== 'Terminated' && names.has(d.acquirer?.name))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
    setDrilldown({ title: row.name, deals: matched })
  }

  const openPEFirmDrill = firm => {
    if (!firm) return
    const matched = deals
      .filter(d => d.status !== 'Terminated' &&
        (d.acquirer?.pe?.firm === firm || d.acquired?.pe?.firm === firm))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
    setDrilldown({ title: firm, deals: matched })
  }

  const openConvergenceDrill = payload => {
    const q = payload?.activeLabel
    if (!q) return
    const cutoff = cutoffDate(5)
    const matched = deals
      .filter(d => d.status !== 'Terminated' && new Date(d.date) >= cutoff && toQtr(d.date) === q)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
    setDrilldown({ title: q, deals: matched })
  }

  const handleNavigate = id => {
    setDrilldown(null)
    onNavigateToDeal?.(id)
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">

        {/* ── Row 1: KPI cards ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <KPICard
            title="TTM Deal Count"
            value={kpi.ttmCount}
            sub="Deals announced (excl. terminated)"
            delta={kpi.cntDelta}
            icon={Activity}
            accent="text-brand-600"
          />
          <KPICard
            title="TTM Deal Value"
            value={kpi.ttmVal}
            sub="Aggregate announced value"
            delta={kpi.valDelta}
            icon={DollarSign}
            accent="text-green-500"
          />
          <KPICard
            title="Pipeline Value"
            value={kpi.pipeVal}
            sub={`${kpi.pipeCount} deals pending or rumored`}
            icon={Layers}
            accent="text-amber-500"
          />
          <KPICard
            title="PE / Infra Share (TTM)"
            value={kpi.peShare}
            sub="Share of TTM aggregate deal value"
            icon={TrendingUp}
            accent="text-indigo-500"
          />
          <KPICard
            title="Subscribers in TTM Deals"
            value={
              kpi.ttmSubs >= 1e6
                ? `${(kpi.ttmSubs / 1e6).toFixed(1)}M`
                : kpi.ttmSubs >= 1e3
                  ? `${(kpi.ttmSubs / 1e3).toFixed(0)}K`
                  : kpi.ttmSubs > 0
                    ? kpi.ttmSubs.toLocaleString()
                    : '—'
            }
            sub="Target subscribers in TTM deals"
            icon={Users}
            accent="text-cyan-500"
          />
        </div>

        {/* ── Row 2: Quarterly Activity + Pipeline ───────────────────────── */}
        <div className="grid grid-cols-3 gap-5">

          <ChartCard
            className="col-span-2"
            title="Quarterly Deal Activity by Acquirer Type"
            subtitle="Aggregate deal value (bars, $B) + deal count (line) — trailing 5 years, excl. terminated · Click any bar to view deals"
          >
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart
                data={qData}
                margin={{ top: 4, right: 28, left: 0, bottom: 28 }}
                onClick={openQuarterDrill}
                style={{ cursor: 'pointer' }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="quarter"
                  tick={{ fontSize: 10 }}
                  angle={-40}
                  textAnchor="end"
                  height={60}
                  interval={1}
                />
                <YAxis
                  yAxisId="val"
                  tickFormatter={v => `$${v.toFixed(0)}B`}
                  tick={{ fontSize: 10 }}
                  width={52}
                />
                <YAxis
                  yAxisId="cnt"
                  orientation="right"
                  tick={{ fontSize: 10 }}
                  width={28}
                  allowDecimals={false}
                />
                <Tooltip content={<QuarterlyTooltip />} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                {ACQTYPES.map(t => (
                  <Bar
                    key={t}
                    yAxisId="val"
                    dataKey={t}
                    stackId="a"
                    fill={ACQTYPE_COLORS[t]}
                    maxBarSize={40}
                    name={t}
                    cursor="pointer"
                  />
                ))}
                <Line
                  yAxisId="cnt"
                  type="linear"
                  dataKey="count"
                  stroke="#955438"
                  strokeWidth={1}
                  dot={{ r: 2.5, fill: '#955438', strokeWidth: 0 }}
                  name="Count"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Deal Pipeline" subtitle="Stage-weighted expected value">
            <div className="flex flex-col gap-5 flex-1 justify-center py-2">
              {pipe.map(s => (
                <div key={s.stage} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-gray-700">{s.stage}</span>
                    <span className="text-gray-400 tabular-nums">
                      {s.count} deal{s.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="relative h-8 bg-gray-100 rounded overflow-hidden">
                    <div
                      className="h-full rounded flex items-center pl-3 transition-all"
                      style={{
                        width:      `${Math.max((s.count / maxPipe) * 100, s.count > 0 ? 12 : 0)}%`,
                        background: s.color,
                      }}
                    >
                      <span className="text-white text-xs font-semibold whitespace-nowrap leading-none">
                        {fmt(s.value) ?? '—'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-400">
                    Weighted: {fmt(s.weighted) ?? '—'}
                  </div>
                </div>
              ))}
              <div className="pt-3 border-t border-gray-100">
                <div className="flex justify-between text-xs font-semibold text-gray-700">
                  <span>Total Weighted Pipeline</span>
                  <span className="text-gray-900">
                    {fmt(pipe.reduce((s, x) => s + x.weighted, 0)) ?? '—'}
                  </span>
                </div>
              </div>
            </div>
          </ChartCard>

        </div>

        {/* ── Row 3: Leaderboard + Size Tiers ────────────────────────────── */}
        <div className="grid grid-cols-2 gap-5">

          <ChartCard
            title="Top acquirers"
            subtitle="By aggregate deal value (excl. terminated)"
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {leader.map((row, i) => {
                const maxV = leader[0]?.value || 1
                const pct  = (row.value / maxV) * 100
                const barColor = ACQTYPE_COLORS[row.type] ?? '#94a3b8'
                const displayVal = row.value >= 1e9
                  ? `$${(row.value / 1e9).toFixed(2)}B`
                  : row.value >= 1e6
                    ? `$${(row.value / 1e6).toFixed(0)}M`
                    : '—'
                return (
                  <div
                    key={row.name}
                    onClick={() => openAcquirerDrill(row)}
                    style={{
                      padding: '10px 0',
                      borderBottom: i < leader.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {/* Name + value row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 7 }}>
                      <span style={{
                        fontSize: 14, fontWeight: 500, color: 'var(--ink-1)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        minWidth: 0,
                      }}>
                        {row.name}
                      </span>
                      <span style={{
                        fontSize: 13, color: 'var(--ink-3)',
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap', flexShrink: 0,
                      }}>
                        {displayVal}&nbsp;·&nbsp;{row.count}
                      </span>
                    </div>
                    {/* Bar track */}
                    <div style={{ height: 6, background: 'rgba(0,0,0,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.max(pct, row.value > 0 ? 1 : 0)}%`,
                        background: barColor,
                        borderRadius: 3,
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Color legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 pt-3 border-t border-gray-100">
              {Object.entries(ACQTYPE_COLORS).map(([label, color]) => (
                <span key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />
                  {label}
                </span>
              ))}
            </div>
          </ChartCard>

          <ChartCard
            title="Deal size distribution"
            subtitle="All deals by size tier (excl. terminated)"
          >
            {/* Donut */}
            <div style={{ position: 'relative', width: 160, height: 160, margin: '0 auto 20px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tiers}
                    dataKey="count"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={78}
                    startAngle={90}
                    endAngle={-270}
                    paddingAngle={1.5}
                    stroke="none"
                  >
                    {tiers.map(t => (
                      <Cell key={t.tier} fill={t.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none',
              }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink-1)', lineHeight: 1 }}>
                  {tiers.reduce((s, t) => s + t.count, 0)}
                </span>
                <span style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3 }}>deals</span>
              </div>
            </div>

            {/* Bar rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {tiers.map(t => (
                <div key={t.tier}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-2)' }}>
                      {TIER_LABELS[t.tier]}
                    </span>
                    <span style={{ fontSize: 12.5, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums', marginLeft: 8, flexShrink: 0 }}>
                      {t.count} deal{t.count !== 1 ? 's' : ''}
                      {t.value > 0 && <span style={{ color: 'var(--ink-5)', marginLeft: 4 }}>· {fmt(t.value)}</span>}
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(0,0,0,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.max((t.count / maxTier) * 100, t.count > 0 ? 2 : 0)}%`,
                      background: t.color,
                      borderRadius: 3,
                    }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Disclosed value footer */}
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-400">Total disclosed value</p>
                <p className="text-base font-bold text-gray-800 mt-0.5">
                  {fmt(tiers.filter(t => t.tier !== 'Bolt-on / Undisclosed').reduce((s, t) => s + t.value, 0))}
                </p>
              </div>
            </div>
          </ChartCard>

        </div>

        {/* ── Row 4: PE Platform + Convergence ───────────────────────────── */}
        <div className="grid grid-cols-2 gap-5">

          <ChartCard
            title="PE & infrastructure activity"
            subtitle="Deal count per sponsor (excl. terminated)"
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {platform.map((row, i) => {
                const maxT    = platform[0]?.total || 1
                const acqPct  = (row.asAcquirer / maxT) * 100
                const tgtPct  = (row.asTarget   / maxT) * 100
                return (
                  <div
                    key={row.firm}
                    onClick={() => openPEFirmDrill(row.firm)}
                    style={{
                      padding: '10px 0',
                      borderBottom: i < platform.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {/* Name + count row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 7 }}>
                      <span style={{
                        fontSize: 14, fontWeight: 500, color: 'var(--ink-1)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        minWidth: 0,
                      }}>
                        {row.firm}
                      </span>
                      <span style={{
                        fontSize: 13, color: 'var(--ink-3)',
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap', flexShrink: 0,
                      }}>
                        {row.asAcquirer > 0 && `${row.asAcquirer} acq`}
                        {row.asAcquirer > 0 && row.asTarget > 0 && ' · '}
                        {row.asTarget   > 0 && `${row.asTarget} tgt`}
                      </span>
                    </div>
                    {/* Stacked bar track */}
                    <div style={{ height: 6, background: 'rgba(0,0,0,0.07)', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                      {row.asAcquirer > 0 && (
                        <div style={{ width: `${acqPct}%`, height: '100%', background: '#5872E0', flexShrink: 0 }} />
                      )}
                      {row.asTarget > 0 && (
                        <div style={{ width: `${tgtPct}%`, height: '100%', background: '#B8744F', flexShrink: 0 }} />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex gap-4 mt-4 pt-3 border-t border-gray-100">
              {[['As acquirer', '#5872E0'], ['Backed target', '#B8744F']].map(([label, color]) => (
                <span key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />
                  {label}
                </span>
              ))}
            </div>
          </ChartCard>

          <ChartCard
            title="Wireline–Wireless Convergence Deals"
            subtitle="Deals combining fixed broadband + mobile assets — trailing 5 years · Click any bar to view deals"
          >
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={conv}
                margin={{ top: 4, right: 16, left: 0, bottom: 28 }}
                onClick={openConvergenceDrill}
                style={{ cursor: 'pointer' }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="quarter"
                  tick={{ fontSize: 10 }}
                  angle={-40}
                  textAnchor="end"
                  height={60}
                  interval={1}
                />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip cursor={{ fill: '#f0f4ff' }} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Convergence"     name="Convergence"     stackId="a" fill="#00DEC8" cursor="pointer" />
                <Bar dataKey="Non-convergence" name="Non-convergence" stackId="a" fill="#d5d6eb" cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

        </div>

        {/* ── Row 5: Terminated Deals Table ──────────────────────────────── */}
        {dead.length > 0 && (
          <ChartCard
            title="Terminated & Abandoned Deals"
            subtitle="Deals that failed to close"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Date', 'Acquirer', 'Target', 'Value', 'Notes'].map(h => (
                      <th
                        key={h}
                        className={`py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide ${
                          h === 'Value' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dead.map(d => (
                    <tr
                      key={d.id}
                      className="border-b border-gray-50 hover:bg-red-50/40 cursor-pointer transition-colors group"
                      onClick={() => handleNavigate(d.id)}
                      title="Click to open in Deal Tracker"
                    >
                      <td className="py-2.5 px-3 text-gray-400 whitespace-nowrap">{d.date.slice(0, 7)}</td>
                      <td className="py-2.5 px-3 font-medium text-gray-800">{d.acquirer?.name}</td>
                      <td className="py-2.5 px-3 text-gray-600">{d.acquired?.name}</td>
                      <td className="py-2.5 px-3 text-right text-gray-600 whitespace-nowrap">
                        {fmt(d.dealValue) ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td
                        className="py-2.5 px-3 text-gray-400 max-w-xs truncate"
                        title={d.notes ?? d.reason ?? undefined}
                      >
                        <span className="group-hover:text-indigo-500 transition-colors flex items-center gap-1">
                          {d.notes ?? d.reason ?? '—'}
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-60 shrink-0" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        )}

      </div>

      {/* Drill-through panel */}
      <DrilldownPanel
        drilldown={drilldown}
        onNavigate={handleNavigate}
        onClose={() => setDrilldown(null)}
      />

    </div>
  )
}
