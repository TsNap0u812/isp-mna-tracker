import { ExternalLink, X, Plus, CheckCircle, Loader2, AlertCircle, Rss, Key } from 'lucide-react'

function fmtDate(str) {
  if (!str) return ''
  try { return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return str.slice(0, 10) }
}

function NewsItem({ item, onCreateDeal }) {
  return (
    <div className={`rounded-lg border p-4 space-y-2 ${item.alreadyTracked ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-brand-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-gray-900 leading-snug flex-1">{item.title}</p>
        {item.alreadyTracked && (
          <span className="shrink-0 flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 font-medium">
            <CheckCircle className="h-3 w-3" /> Tracked
          </span>
        )}
      </div>
      {item.description && (
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{item.description}</p>
      )}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="font-medium text-gray-600">{item.sourceName}</span>
          {item.pubDate && <span>· {fmtDate(item.pubDate)}</span>}
        </div>
        <div className="flex items-center gap-2">
          {item.link && (
            <a href={item.link} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium">
              <ExternalLink className="h-3 w-3" /> Read
            </a>
          )}
          <button
            onClick={() => onCreateDeal(item)}
            className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg ${
              item.alreadyTracked
                ? 'bg-gray-200 hover:bg-gray-300 text-gray-600'
                : 'bg-brand-600 hover:bg-brand-700 text-white'
            }`}
          >
            <Plus className="h-3 w-3" /> {item.alreadyTracked ? 'Add Anyway' : 'Add Deal'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function RefreshModal({ state, data, error, onClose, onCreateDeal }) {
  const newItems = data?.items?.filter(i => !i.alreadyTracked) ?? []
  const trackedItems = data?.items?.filter(i => i.alreadyTracked) ?? []

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="font-bold text-gray-900">Deal Intelligence — Past 6 Months</h2>
            {data && (
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                {data.source === 'NewsAPI' ? <Key className="h-3 w-3" /> : <Rss className="h-3 w-3" />}
                Source: {data.source}
                {!data.hasApiKey && ' · Set NEWS_API_KEY for richer results'}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 scrollbar-thin">

          {state === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
              <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
              <p className="text-sm">Scanning news sources…</p>
            </div>
          )}

          {state === 'error' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-500">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm font-medium">Could not reach the API server</p>
              <p className="text-xs text-gray-400 text-center max-w-xs">
                Make sure both servers are running:<br />
                <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">npm run dev</code>
              </p>
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>
          )}

          {state === 'results' && newItems.length === 0 && trackedItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400">
              <CheckCircle className="h-8 w-8 text-green-400" />
              <p className="text-sm font-medium text-gray-600">No new deals found</p>
              <p className="text-xs">Try again after setting a NewsAPI key for broader coverage.</p>
            </div>
          )}

          {state === 'results' && newItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide mb-2">
                {newItems.length} potential new deal{newItems.length !== 1 ? 's' : ''} — not yet tracked
              </p>
              <div className="space-y-2">
                {newItems.map((item, i) => (
                  <NewsItem key={i} item={item} onCreateDeal={onCreateDeal} />
                ))}
              </div>
            </div>
          )}

          {state === 'results' && trackedItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 mt-4">
                {trackedItems.length} already in dashboard
              </p>
              <div className="space-y-2">
                {trackedItems.map((item, i) => (
                  <NewsItem key={i} item={item} onCreateDeal={onCreateDeal} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {state === 'results' && (
          <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400 text-right">
            Scanned {fmtDate(data?.fetchedAt)} · Click "Add Deal" to enter deal details
          </div>
        )}
      </div>
    </div>
  )
}
