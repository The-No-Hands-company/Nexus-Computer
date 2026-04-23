import { useEffect, useState, useCallback } from 'react'

function fmt(bytes) {
  if (!bytes) return '0 B'
  const k = 1024, sizes = ['B','KB','MB','GB','TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function fmtUptime(s) {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`
}

function BarMeter({ pct, color }) {
  const c = pct > 85 ? 'var(--red)' : pct > 65 ? 'var(--amber)' : (color || 'var(--accent)')
  return (
    <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden', marginTop: 4 }}>
      <div style={{ height: '100%', width: `${Math.min(100, pct || 0)}%`, background: c, borderRadius: 2, transition: 'width 0.5s' }} />
    </div>
  )
}

function StatCard({ label, value, sub, pct, color }) {
  return (
    <div style={{
      padding: '14px', background: 'var(--bg-3)', border: '1px solid var(--border)',
      borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{sub}</div>}
      {pct !== undefined && <BarMeter pct={pct} color={color} />}
    </div>
  )
}

const S = {
  wrap: { flex: 1, overflowY: 'auto', padding: '0', display: 'flex', flexDirection: 'column' },
  header: {
    padding: '12px 16px', borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  title: { fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700 },
  body: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  aiRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 14px', borderRadius: 6,
    border: '1px solid var(--border)', background: 'var(--bg-3)',
  },
  dot: (ok) => ({
    width: 8, height: 8, borderRadius: '50%',
    background: ok ? 'var(--green)' : 'var(--red)',
    boxShadow: ok ? '0 0 8px var(--green)' : 'none',
    animation: ok ? 'pulse 2s infinite' : 'none',
    flexShrink: 0,
  }),
  aiLabel: { fontSize: 12, color: 'var(--text)', flex: 1 },
  aiSub: { fontSize: 10, color: 'var(--text-muted)' },
  sectionLabel: { fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 },
  quickRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  qBtn: {
    padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 20,
    background: 'var(--bg-3)', color: 'var(--text-dim)', fontSize: 11,
    cursor: 'pointer', transition: 'all 0.15s',
    letterSpacing: '0.06em',
  },
  valueRow: { display: 'flex', flexDirection: 'column', gap: 6 },
  valueItem: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '6px 10px', background: 'var(--bg-3)', borderRadius: 4,
    border: '1px solid var(--border)',
  },
  vLabel: { fontSize: 11, color: 'var(--text-dim)' },
  vVal: { fontSize: 11, color: 'var(--text)', fontFamily: 'var(--font-mono)' },
}

const QUICK = [
  { label: 'New chat', msg: 'Hello Nexus, what can you help me with today?' },
  { label: 'Show disk usage', msg: 'Show me disk usage in the workspace' },
  { label: 'List processes', msg: 'List running processes' },
  { label: 'System info', msg: 'Show full system information' },
  { label: 'Git status', msg: 'Run git status in the workspace' },
]

export default function HomePanel({ onQuickPrompt }) {
  const [meta, setMeta] = useState(null)
  const [nexusAi, setNexusAi] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const [m, ai] = await Promise.all([
        fetch('/api/meta').then(r => r.json()).catch(() => null),
        fetch('/api/models').then(r => r.json()).catch(() => null),
      ])
      setMeta(m)
      const aiModel = ai?.models?.find(m => m.id === 'nexus-ai')
      setNexusAi(aiModel)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const disk = meta?.disk || {}
  const diskPct = disk.total ? Math.round((disk.used / disk.total) * 100) : 0
  const aiOnline = nexusAi?.available === true

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <span style={S.title}>Home</span>
        <button
          style={{ fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer', letterSpacing: '0.08em' }}
          onClick={load}
        >{refreshing ? 'Refreshing...' : 'Refresh'}</button>
      </div>

      <div style={S.body}>
        {/* Nexus AI status */}
        <div>
          <div style={S.sectionLabel}>Intelligence</div>
          <div style={S.aiRow}>
            <div style={S.dot(aiOnline)} />
            <div style={{ flex: 1 }}>
              <div style={S.aiLabel}>Nexus AI — {aiOnline ? 'Online' : 'Offline'}</div>
              <div style={S.aiSub}>{nexusAi?.capabilities?.local ? 'Local · Private · No data leaves this machine' : 'Connect Nexus AI to enable intelligence'}</div>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div>
          <div style={S.sectionLabel}>Node stats</div>
          <div style={S.grid}>
            <StatCard
              label="Storage used"
              value={fmt(disk.used || 0)}
              sub={`of ${fmt(disk.total || 0)} · ${diskPct}% used`}
              pct={diskPct}
            />
            <StatCard
              label="Storage free"
              value={fmt(disk.free || 0)}
              sub="available on volume"
            />
            <StatCard
              label="Uptime"
              value={fmtUptime(meta?.uptime_seconds || 0)}
              sub="since last restart"
              color="var(--green)"
            />
            <StatCard
              label="Sessions"
              value={meta?.session_count ?? '—'}
              sub={`${meta?.plugin_count ?? 0} plugins installed`}
            />
          </div>
        </div>

        {/* Node info */}
        <div>
          <div style={S.sectionLabel}>Node info</div>
          <div style={S.valueRow}>
            {[
              ['Platform', meta?.platform || '—'],
              ['Python', meta?.python || '—'],
              ['Account', meta?.account_name || '—'],
              ['Active session', meta?.active_session_label || '—'],
            ].map(([l, v]) => (
              <div key={l} style={S.valueItem}>
                <span style={S.vLabel}>{l}</span>
                <span style={S.vVal}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Values */}
        <div>
          <div style={S.sectionLabel}>Core values</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(meta?.values || ['free as in freedom','privacy first','no paywalls','open source']).map(v => (
              <span key={v} style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 10,
                border: '1px solid var(--border)', color: 'var(--text-dim)',
                background: 'var(--bg-3)', letterSpacing: '0.06em',
              }}>{v}</span>
            ))}
          </div>
        </div>

        {/* Quick prompts */}
        {onQuickPrompt && (
          <div>
            <div style={S.sectionLabel}>Quick actions</div>
            <div style={S.quickRow}>
              {QUICK.map(({ label, msg }) => (
                <button
                  key={label}
                  style={S.qBtn}
                  onClick={() => onQuickPrompt(msg)}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-dim)'; e.currentTarget.style.color = 'var(--accent)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}
                >{label}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
