import { useCallback, useEffect, useState } from 'react'

const S = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-2)',
    borderBottom: '1px solid var(--border)',
    minHeight: '220px',
    maxHeight: '320px',
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
    background: 'rgba(0,217,255,0.05)',
    letterSpacing: '0.08em',
  },
  list: {
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    overflowY: 'auto',
  },
  item: {
    border: '1px solid var(--border-dim)',
    background: 'rgba(255,255,255,0.015)',
    borderRadius: '8px',
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  itemTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  event: {
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--text-dim)',
  },
  toolName: {
    fontSize: '12px',
    color: 'var(--text)',
    fontWeight: 600,
  },
  status: (ok) => ({
    fontSize: '10px',
    color: ok ? 'var(--green)' : 'var(--red)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  }),
  preview: {
    color: 'var(--text-dim)',
    fontSize: '11px',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: '72px',
    overflow: 'hidden',
  },
  empty: {
    color: 'var(--text-muted)',
    fontSize: '11px',
    lineHeight: 1.6,
    padding: '8px 0',
  },
}

export default function ActionsPanel() {
  const [items, setItems] = useState([])

  const load = useCallback(async () => {
    const res = await fetch('/api/actions?limit=40', { headers: { Accept: 'application/json' } })
    if (!res.ok) return
    const data = await res.json()
    setItems(data.items || [])
  }, [])

  useEffect(() => {
    load().catch(() => {})
    const timer = setInterval(() => load().catch(() => {}), 5000)
    return () => clearInterval(timer)
  }, [load])

  return (
    <section style={S.panel}>
      <div style={S.header}>
        <div style={S.title}>Action ledger</div>
        <div style={S.badge}>{items.length} recent</div>
      </div>
      <div style={S.list}>
        {items.length === 0 && <div style={S.empty}>No recorded actions yet.</div>}
        {items.slice(0, 20).map(item => {
          const ok = (item.result_status || 'ok') === 'ok'
          const preview = item.event_type === 'tool_use'
            ? JSON.stringify(item.tool_input || {}, null, 2)
            : (item.result_preview || '')
          return (
            <article key={item.id} style={S.item}>
              <div style={S.itemTop}>
                <span style={S.event}>{item.event_type || 'event'}</span>
                <span style={S.status(ok)}>{item.result_status || 'logged'}</span>
              </div>
              <div style={S.toolName}>{item.tool_name || 'system'}</div>
              <div style={S.preview}>{preview}</div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
