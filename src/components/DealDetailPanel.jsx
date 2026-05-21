import { X, Building2, MapPin, Users, DollarSign, Calendar, Tag, Target, Briefcase, Info } from 'lucide-react'

const fmt = (v) =>
  v >= 1e9
    ? `$${(v / 1e9).toFixed(2)}B`
    : v >= 1e6
    ? `$${(v / 1e6).toFixed(0)}M`
    : `$${v.toLocaleString()}`

function Section({ icon: Icon, title, children }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-brand-600 shrink-0" />
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="pl-6 space-y-1">{children}</div>
    </div>
  )
}

function Row({ label, value }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-gray-500 shrink-0 w-36">{label}</span>
      <span className="text-gray-900">{value}</span>
    </div>
  )
}

function PECard({ pe, role }) {
  if (!pe) return null
  return (
    <div className="mt-3 bg-brand-50 border border-brand-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Building2 className="h-4 w-4 text-brand-700" />
        <span className="text-xs font-bold text-brand-800 uppercase tracking-wide">PE Backer — {role}</span>
      </div>
      <div className="space-y-1.5 text-sm">
        <div className="font-semibold text-gray-900 text-base">{pe.firm}</div>
        <Row label="Firm Type" value={pe.firmType} />
        <Row label="AUM" value={pe.aum} />
        <Row label="HQ" value={pe.headquarters} />
        {pe.primaryFunds?.length > 0 && (
          <div className="flex gap-2">
            <span className="text-gray-500 shrink-0 w-36">Primary Funds</span>
            <ul className="text-gray-900 space-y-0.5">
              {pe.primaryFunds.map(f => <li key={f} className="before:content-['•'] before:mr-1 before:text-brand-400">{f}</li>)}
            </ul>
          </div>
        )}
        {pe.otherTelecomPortfolio?.length > 0 && (
          <div className="flex gap-2">
            <span className="text-gray-500 shrink-0 w-36">Other Portfolio</span>
            <div className="flex flex-wrap gap-1">
              {pe.otherTelecomPortfolio.map(p => (
                <span key={p} className="text-xs bg-white border border-brand-200 text-brand-700 rounded px-1.5 py-0.5">{p}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function DealDetailPanel({ deal, onClose }) {
  if (!deal) return null

  const hasPE = deal.acquirer.pe || deal.acquired.pe

  return (
    <div className="w-[420px] shrink-0 bg-white border-l border-gray-200 flex flex-col h-full overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 bg-brand-700">
        <div>
          <div className="text-xs text-brand-200 font-medium uppercase tracking-wide mb-0.5">{deal.dealType} · {deal.date.slice(0, 7)}</div>
          <h2 className="text-white font-bold text-base leading-tight">
            {deal.acquirer.name} → {deal.acquired.name}
          </h2>
          <div className="text-brand-200 text-sm mt-0.5">{fmt(deal.dealValue)}{deal.ownershipPct < 100 ? ` · ${deal.ownershipPct}% stake` : ''}</div>
        </div>
        <button onClick={onClose} className="text-brand-300 hover:text-white mt-0.5 shrink-0">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Status pill */}
      <div className="px-5 py-2 border-b border-gray-100 bg-gray-50">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
          deal.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
        }`}>
          {deal.status}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-5">

        <Section icon={DollarSign} title="Deal Terms">
          <Row label="Deal Value" value={fmt(deal.dealValue)} />
          <Row label="Ownership" value={deal.ownershipPct === 100 ? '100% (full acquisition)' : `${deal.ownershipPct}%`} />
          <Row label="Deal Type" value={deal.dealType} />
          {deal.subscribers && <Row label="Subscribers" value={deal.subscribers.toLocaleString()} />}
          {deal.keyTerms && (
            <div className="mt-2 text-sm text-gray-700 bg-gray-50 rounded-lg p-3 leading-relaxed">
              {deal.keyTerms}
            </div>
          )}
        </Section>

        <Section icon={Briefcase} title="Parties">
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-400 uppercase font-medium mb-1">Acquirer</div>
              <div className="font-semibold text-gray-900">{deal.acquirer.name}</div>
              <div className="text-gray-500 text-xs">{deal.acquirer.type}{deal.acquirer.ticker ? ` · ${deal.acquirer.ticker}` : ''}</div>
              <PECard pe={deal.acquirer.pe} role="Acquirer" />
            </div>
            <div className="border-t border-gray-100 pt-3">
              <div className="text-xs text-gray-400 uppercase font-medium mb-1">Acquired / Target</div>
              <div className="font-semibold text-gray-900">{deal.acquired.name}</div>
              <div className="text-gray-500 text-xs">{deal.acquired.type}{deal.acquired.ticker ? ` · ${deal.acquired.ticker}` : ''}</div>
              <PECard pe={deal.acquired.pe} role="Target" />
            </div>
          </div>
        </Section>

        <Section icon={Target} title="Reason for Acquisition">
          <p className="text-sm text-gray-700 leading-relaxed">{deal.reason}</p>
        </Section>

        <Section icon={Info} title="Strategic Importance">
          <p className="text-sm text-gray-700 leading-relaxed">{deal.strategicImportance}</p>
        </Section>

        {deal.geography?.length > 0 && (
          <Section icon={MapPin} title="Geography">
            <div className="flex flex-wrap gap-1">
              {deal.geography.map(g => (
                <span key={g} className="text-xs bg-gray-100 text-gray-700 rounded px-2 py-0.5">{g}</span>
              ))}
            </div>
          </Section>
        )}

        {deal.notes && (
          <Section icon={Tag} title="Notes">
            <p className="text-sm text-gray-600 leading-relaxed italic">{deal.notes}</p>
          </Section>
        )}
      </div>
    </div>
  )
}
