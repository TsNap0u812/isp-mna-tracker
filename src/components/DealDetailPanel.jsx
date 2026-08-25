import { X, DollarSign, Briefcase, MapPin, Tag, BarChart2, Sparkles } from 'lucide-react'

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtMonth = (iso) => {
  if (!iso) return ''
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  } catch {
    return iso.slice(0, 7)
  }
}

const fmtCurrency = (v) =>
  !v        ? '—'
  : v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B`
  : v >= 1e6 ? `$${(v / 1e6).toFixed(0)}M`
  : `$${v.toLocaleString()}`

// ── StatusPill ───────────────────────────────────────────────────────────────

function StatusPill({ status, size = 'sm' }) {
  const styles = {
    'Completed':                   { dot: '#009d8c', bg: '#d6f8f4', text: '#007a6e' },
    'Completing':                  { dot: '#0fb8a8', bg: '#d6f8f4', text: '#0a8a7e' },
    'Pending / Regulatory Review': { dot: '#D97706', bg: '#FEF3C7', text: '#92400e' },
    'Rumored / In Discussions':    { dot: '#5872E0', bg: '#e6eafe', text: '#3f56c0' },
    'Terminated':                  { dot: '#DC2626', bg: '#FEE2E2', text: '#b91c1c' },
  }
  const s = styles[status] || { dot: '#86868b', bg: '#f3f4f6', text: '#6e6e73' }
  const isLg = size === 'lg'

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: isLg ? 6 : 5,
      padding: isLg ? '5px 10px' : '3px 8px',
      borderRadius: 20,
      background: s.bg,
      fontSize: isLg ? 13 : 11.5,
      fontWeight: isLg ? 600 : 500,
      color: s.text,
      whiteSpace: 'nowrap',
      letterSpacing: '-0.005em',
    }}>
      <span style={{
        width: isLg ? 7 : 6,
        height: isLg ? 7 : 6,
        borderRadius: '50%',
        background: s.dot,
        flexShrink: 0,
      }} />
      {status}
    </span>
  )
}

// ── KV Row ───────────────────────────────────────────────────────────────────

function KV({ label, value }) {
  if (!value && value !== 0) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, fontSize: 13.5, lineHeight: 1.5 }}>
      <span style={{ color: '#86868b' }}>{label}</span>
      <span style={{ color: '#1d1d1f' }}>{value}</span>
    </div>
  )
}

// ── Section ──────────────────────────────────────────────────────────────────

function Section({ icon: Icon, title, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        marginBottom: 10,
      }}>
        <Icon size={13} style={{ color: '#86868b', flexShrink: 0 }} />
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: '#86868b',
        }}>
          {title}
        </span>
      </div>
      <div style={{ paddingLeft: 20 }}>
        {children}
      </div>
    </div>
  )
}

// ── PE Block ─────────────────────────────────────────────────────────────────

function PEBlock({ pe, role }) {
  if (!pe) return null
  return (
    <div style={{
      marginTop: 10,
      background: '#fbfafa',
      borderRadius: 8,
      padding: '12px 14px',
      border: '1px solid rgba(0,0,0,0.06)',
    }}>
      <div style={{
        fontSize: 10.5,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        color: '#3f56c0',
        marginBottom: 6,
      }}>
        PE Backer · {role}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#1d1d1f', marginBottom: 8 }}>
        {pe.firm}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', marginBottom: 8 }}>
        {pe.firmType && (
          <div>
            <div style={{ fontSize: 10.5, color: '#86868b', marginBottom: 1 }}>Type</div>
            <div style={{ fontSize: 12, color: '#424245' }}>{pe.firmType}</div>
          </div>
        )}
        {pe.aum && (
          <div>
            <div style={{ fontSize: 10.5, color: '#86868b', marginBottom: 1 }}>AUM</div>
            <div style={{ fontSize: 12, color: '#424245' }}>{pe.aum}</div>
          </div>
        )}
        {pe.headquarters && (
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 10.5, color: '#86868b', marginBottom: 1 }}>HQ</div>
            <div style={{ fontSize: 12, color: '#424245' }}>{pe.headquarters}</div>
          </div>
        )}
      </div>
      {pe.otherTelecomPortfolio?.length > 0 && (
        <div>
          <div style={{ fontSize: 10.5, color: '#86868b', marginBottom: 5 }}>Portfolio</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {pe.otherTelecomPortfolio.map(p => (
              <span key={p} style={{
                fontSize: 11,
                padding: '2px 7px',
                borderRadius: 4,
                background: '#ffffff',
                border: '1px solid rgba(0,0,0,0.08)',
                color: '#424245',
              }}>
                {p}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function DealDetailPanel({ deal, onClose }) {
  if (!deal) return null

  const valueStr = fmtCurrency(deal.dealValue)
  const hasOwnership = deal.ownershipPct && deal.ownershipPct < 100

  return (
    <div
      className="animate-sheet"
      style={{
        width: 460,
        minWidth: 460,
        background: '#ffffff',
        borderLeft: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '-20px 0 40px -30px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{
        padding: '18px 22px 14px',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        flexShrink: 0,
        background: '#ffffff',
      }}>
        {/* Row 1: type · date + close button */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: '#86868b',
          }}>
            {deal.dealType} · {fmtMonth(deal.date)}
          </span>
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(0,0,0,0.05)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#424245',
              flexShrink: 0,
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.10)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
          >
            <X size={14} />
          </button>
        </div>

        {/* Row 2: Acquirer → Target */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: 11, color: '#86868b', marginBottom: 1 }}>Acquirer</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              {deal.acquirer.name}
            </div>
          </div>
          <div style={{ paddingTop: 18, color: '#aeaeb2', flexShrink: 0 }}>→</div>
          <div>
            <div style={{ fontSize: 11, color: '#86868b', marginBottom: 1 }}>Target</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              {deal.acquired.name}
            </div>
          </div>
        </div>

        {/* Row 3: Status pill + value */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <StatusPill status={deal.status} size="lg" />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{
              fontSize: 22,
              fontWeight: 600,
              color: '#1d1d1f',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.015em',
              lineHeight: 1,
            }}>
              {valueStr}
            </span>
            {hasOwnership && (
              <span style={{ fontSize: 13, color: '#86868b' }}>
                · {deal.ownershipPct}% stake
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────── */}
      <div
        className="scroll-area"
        style={{ flex: 1, overflowY: 'auto', padding: '18px 22px 32px' }}
      >
        {/* Deal terms */}
        <Section icon={DollarSign} title="Deal Terms">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <KV label="Deal Value" value={fmtCurrency(deal.dealValue)} />
            <KV
              label="Ownership"
              value={deal.ownershipPct === 100
                ? '100% (full acquisition)'
                : deal.ownershipPct ? `${deal.ownershipPct}%` : null
              }
            />
            <KV label="Deal Type" value={deal.dealType} />
            {deal.subscribers && (
              <KV label="Subscribers" value={deal.subscribers.toLocaleString()} />
            )}
          </div>
          {deal.keyTerms && (
            <div style={{
              marginTop: 10,
              background: '#fbfafa',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 13,
              color: '#424245',
              lineHeight: 1.6,
              border: '1px solid rgba(0,0,0,0.05)',
            }}>
              {deal.keyTerms}
            </div>
          )}
        </Section>

        {/* Parties */}
        <Section icon={Briefcase} title="Parties">
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#aeaeb2', marginBottom: 3 }}>
              Acquirer
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1d1d1f' }}>{deal.acquirer.name}</div>
            <div style={{ fontSize: 12, color: '#6e6e73', marginTop: 1 }}>
              {deal.acquirer.type}{deal.acquirer.ticker ? ` · ${deal.acquirer.ticker}` : ''}
            </div>
            <PEBlock pe={deal.acquirer.pe} role="Acquirer" />
          </div>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#aeaeb2', marginBottom: 3 }}>
              Target
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1d1d1f' }}>{deal.acquired.name}</div>
            <div style={{ fontSize: 12, color: '#6e6e73', marginTop: 1 }}>
              {deal.acquired.type}{deal.acquired.ticker ? ` · ${deal.acquired.ticker}` : ''}
            </div>
            <PEBlock pe={deal.acquired.pe} role="Target" />
          </div>
        </Section>

        {/* Rationale */}
        {deal.reason && (
          <Section icon={Sparkles} title="Rationale">
            <p style={{ fontSize: 13, color: '#424245', lineHeight: 1.65, margin: 0 }}>
              {deal.reason}
            </p>
          </Section>
        )}

        {/* Strategic context */}
        {deal.strategicImportance && (
          <Section icon={BarChart2} title="Strategic Context">
            <p style={{ fontSize: 13, color: '#424245', lineHeight: 1.65, margin: 0 }}>
              {deal.strategicImportance}
            </p>
          </Section>
        )}

        {/* Geography */}
        {deal.geography?.length > 0 && (
          <Section icon={MapPin} title="Geography">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {deal.geography.map(g => (
                <span key={g} style={{
                  fontSize: 11.5,
                  padding: '3px 8px',
                  borderRadius: 5,
                  background: 'rgba(0,0,0,0.05)',
                  color: '#424245',
                }}>
                  {g}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Notes */}
        {deal.notes && (
          <Section icon={Tag} title="Notes">
            <p style={{ fontSize: 13, color: '#6e6e73', lineHeight: 1.65, fontStyle: 'italic', margin: 0 }}>
              {deal.notes}
            </p>
          </Section>
        )}
      </div>
    </div>
  )
}
