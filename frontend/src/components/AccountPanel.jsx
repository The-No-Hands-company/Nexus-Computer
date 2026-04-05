import { useCallback, useEffect, useState } from 'react'

const S = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    height: '220px',
    minHeight: '180px',
    background: 'var(--bg-2)',
    borderTop: '1px solid var(--border)',
    overflow: 'hidden',
  },
  header: {
    padding: '8px 12px',
    borderBottom: '1px solid var(--border-dim)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  title: {
    fontSize: '10px',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--text-dim)',
    fontWeight: 700,
  },
  badge: {
    fontSize: '9px',
    padding: '2px 6px',
    borderRadius: '999px',
    border: '1px solid rgba(0,217,255,0.18)',
    color: 'var(--accent)',
    background: 'rgba(0,217,255,0.04)',
    letterSpacing: '0.08em',
  },
  body: {
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    overflow: 'hidden',
    flex: 1,
  },
  card: {
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid var(--border-dim)',
    background: 'rgba(255,255,255,0.015)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  label: {
    color: 'var(--text-muted)',
    fontSize: '10px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  value: {
    color: 'var(--text)',
    fontSize: '12px',
    fontWeight: 600,
  },
  sub: {
    color: 'var(--text-dim)',
    fontSize: '11px',
    lineHeight: 1.5,
  },
  smallRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  pill: {
    padding: '3px 8px',
    borderRadius: '999px',
    border: '1px solid var(--border)',
    background: 'rgba(255,255,255,0.02)',
    color: 'var(--text-dim)',
    fontSize: '10px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  empty: {
    color: 'var(--text-muted)',
    fontSize: '11px',
    lineHeight: 1.6,
  },
}

export default function AccountPanel() {
  const [account, setAccount] = useState(null)
  const [sessions, setSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [plugins, setPlugins] = useState([])

  const load = useCallback(async () => {
    const [accountRes, sessionsRes, pluginsRes] = await Promise.all([
      fetch('/api/account', { headers: { Accept: 'application/json' } }),
      fetch('/api/sessions', { headers: { Accept: 'application/json' } }),
      fetch('/api/plugins', { headers: { Accept: 'application/json' } }),
    ])
    const accountData = await accountRes.json()
    const sessionsData = await sessionsRes.json()
    const pluginsData = await pluginsRes.json()
    setAccount(accountData.account)
    setSessions(sessionsData.items || [])
    setActiveSessionId(sessionsData.active_session_id || null)
    setPlugins(pluginsData.items || [])
  }, [])

  useEffect(() => { load().catch(() => {}) }, [load])

  const activeSession = sessions.find(item => item.id === activeSessionId)

  return (
    <section style={S.panel}>
      <div style={S.header}>
        <div style={S.title}>Account & sessions</div>
        <div style={S.badge}>{sessions.length} sessions</div>
      </div>
      <div style={S.body}>
        {account ? (
          <div style={S.card}>
            <div style={S.label}>Identity</div>
            <div style={S.value}>{account.name}</div>
            <div style={S.sub}>@{account.handle} · {account.bio}</div>
          </div>
        ) : <div style={S.empty}>Loading account...</div>}

        {activeSession && (
          <div style={S.card}>
            <div style={S.label}>Active session</div>
            <div style={S.value}>{activeSession.label}</div>
            <div style={S.sub}>Persistent workspace-backed session</div>
          </div>
        )}

        <div style={S.smallRow}>
          <span style={S.pill}>{plugins.length} plugins</span>
          <span style={S.pill}>Local-first</span>
          <span style={S.pill}>No lock-in</span>
        </div>
      </div>
    </section>
  )
}
