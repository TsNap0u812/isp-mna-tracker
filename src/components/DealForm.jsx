import { useState } from 'react'
import { X, Plus, Minus } from 'lucide-react'
import { DEAL_TYPES, STATUSES, ISP_TYPES } from '../data/deals'

const EMPTY = {
  date: new Date().toISOString().slice(0, 10),
  status: 'Pending / Regulatory Review',
  dealType: 'Acquisition',
  acquirer: { name: '', type: 'MSO (Cable)', ticker: '', pe: null },
  acquired: { name: '', type: 'ILEC / Fiber', ticker: '', pe: null },
  dealValue: '',
  ownershipPct: 100,
  geography: [],
  subscribers: '',
  reason: '',
  strategicImportance: '',
  keyTerms: '',
  notes: '',
}

function Field({ label, children, required }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const input = 'w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500'
const textarea = `${input} resize-none`

function PartySection({ label, value, onChange }) {
  const [showPE, setShowPE] = useState(false)

  const set = (k, v) => onChange({ ...value, [k]: v })
  const setPE = (k, v) => onChange({ ...value, pe: { ...(value.pe || {}), [k]: v } })

  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Company Name" required>
          <input className={input} value={value.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Charter Communications" />
        </Field>
        <Field label="ISP Type" required>
          <select className={input} value={value.type} onChange={e => set('type', e.target.value)}>
            {ISP_TYPES.filter(t => t !== 'All Types').map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Ticker Symbol (optional)">
        <input className={input} value={value.ticker || ''} onChange={e => set('ticker', e.target.value)} placeholder="e.g. CHTR" />
      </Field>
      <button
        type="button"
        onClick={() => { setShowPE(v => !v); if (!value.pe && !showPE) set('pe', { firm: '', firmType: '', aum: '', primaryFunds: [], otherTelecomPortfolio: [], headquarters: '' }) }}
        className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium"
      >
        {showPE ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
        {showPE ? 'Hide PE details' : 'Add PE backer info'}
      </button>
      {showPE && value.pe && (
        <div className="border-t border-gray-200 pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="PE Firm Name">
              <input className={input} value={value.pe.firm || ''} onChange={e => setPE('firm', e.target.value)} placeholder="e.g. KKR & Co." />
            </Field>
            <Field label="Firm Type">
              <input className={input} value={value.pe.firmType || ''} onChange={e => setPE('firmType', e.target.value)} placeholder="e.g. Infrastructure PE" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="AUM">
              <input className={input} value={value.pe.aum || ''} onChange={e => setPE('aum', e.target.value)} placeholder="e.g. $100B+" />
            </Field>
            <Field label="HQ">
              <input className={input} value={value.pe.headquarters || ''} onChange={e => setPE('headquarters', e.target.value)} placeholder="e.g. New York, NY" />
            </Field>
          </div>
          <Field label="Primary Funds (one per line)">
            <textarea
              className={textarea}
              rows={2}
              value={(value.pe.primaryFunds || []).join('\n')}
              onChange={e => setPE('primaryFunds', e.target.value.split('\n').filter(Boolean))}
              placeholder="Fund IX&#10;Fund X"
            />
          </Field>
          <Field label="Other Portfolio Companies (one per line)">
            <textarea
              className={textarea}
              rows={2}
              value={(value.pe.otherTelecomPortfolio || []).join('\n')}
              onChange={e => setPE('otherTelecomPortfolio', e.target.value.split('\n').filter(Boolean))}
              placeholder="Company A&#10;Company B"
            />
          </Field>
        </div>
      )}
    </div>
  )
}

export default function DealForm({ initial, sourceUrl, onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    ...initial,
    acquirer: { ...EMPTY.acquirer, ...(initial?.acquirer || {}) },
    acquired: { ...EMPTY.acquired, ...(initial?.acquired || {}) },
    notes: [initial?.notes, sourceUrl ? `Source: ${sourceUrl}` : ''].filter(Boolean).join('\n'),
  }))
  const [errors, setErrors] = useState({})

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.acquirer.name.trim()) e.acquirer = 'Required'
    if (!form.acquired.name.trim()) e.acquired = 'Required'
    if (!form.date) e.date = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    onSave({
      ...form,
      dealValue: form.dealValue ? Number(String(form.dealValue).replace(/[^0-9.]/g, '')) : 0,
      ownershipPct: Number(form.ownershipPct) || 100,
      subscribers: form.subscribers ? Number(form.subscribers) : null,
      geography: typeof form.geography === 'string'
        ? form.geography.split(',').map(s => s.trim()).filter(Boolean)
        : form.geography,
      acquirer: { ...form.acquirer, pe: form.acquirer.pe?.firm ? form.acquirer.pe : null },
      acquired: { ...form.acquired, pe: form.acquired.pe?.firm ? form.acquired.pe : null },
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Add New Deal</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5 scrollbar-thin">

          {/* Deal overview */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Close / Announced Date" required>
              <input type="date" className={`${input} ${errors.date ? 'border-red-400' : ''}`}
                value={form.date} onChange={e => set('date', e.target.value)} />
            </Field>
            <Field label="Deal Type">
              <select className={input} value={form.dealType} onChange={e => set('dealType', e.target.value)}>
                {DEAL_TYPES.filter(t => t !== 'All Deal Types').map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className={input} value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.filter(s => s !== 'All Statuses').map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Deal Value (USD)">
              <input className={input} value={form.dealValue} onChange={e => set('dealValue', e.target.value)}
                placeholder="e.g. 2500000000" />
            </Field>
            <Field label="Ownership %">
              <input type="number" min="1" max="100" className={input} value={form.ownershipPct}
                onChange={e => set('ownershipPct', e.target.value)} />
            </Field>
            <Field label="Subscribers">
              <input className={input} value={form.subscribers || ''} onChange={e => set('subscribers', e.target.value)}
                placeholder="e.g. 500000" />
            </Field>
          </div>

          {/* Parties */}
          <div className="space-y-3">
            <PartySection
              label={`Acquirer${errors.acquirer ? ' — ' + errors.acquirer : ''}`}
              value={form.acquirer}
              onChange={v => set('acquirer', v)}
            />
            <PartySection
              label={`Acquired / Target${errors.acquired ? ' — ' + errors.acquired : ''}`}
              value={form.acquired}
              onChange={v => set('acquired', v)}
            />
          </div>

          {/* Context */}
          <Field label="Geography (comma-separated states/countries)">
            <input className={input}
              value={Array.isArray(form.geography) ? form.geography.join(', ') : form.geography}
              onChange={e => set('geography', e.target.value)}
              placeholder="e.g. TX, CA, NY or United States (National)" />
          </Field>
          <Field label="Reason for Acquisition">
            <textarea className={textarea} rows={3} value={form.reason}
              onChange={e => set('reason', e.target.value)}
              placeholder="Why did the acquirer pursue this deal?" />
          </Field>
          <Field label="Strategic Importance">
            <textarea className={textarea} rows={3} value={form.strategicImportance}
              onChange={e => set('strategicImportance', e.target.value)}
              placeholder="What does this mean for the industry?" />
          </Field>
          <Field label="Key Terms">
            <textarea className={textarea} rows={2} value={form.keyTerms}
              onChange={e => set('keyTerms', e.target.value)}
              placeholder="Price per share, conditions, structure..." />
          </Field>
          <Field label="Notes / Source">
            <textarea className={textarea} rows={2} value={form.notes}
              onChange={e => set('notes', e.target.value)} />
          </Field>
        </form>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg">
            Cancel
          </button>
          <button onClick={handleSubmit}
            className="px-5 py-2 text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-lg">
            Add to Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
