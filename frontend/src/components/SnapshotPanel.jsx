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
  body: {
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    overflowY: 'auto',
    flex: 1,
  },
  row: {
    display: 'flex',
    gap: '8px',
  },
  input: {
    flex: 1,
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--bg-3)',
    color: 'var(--text)',
    fontSize: '12px',
  },
  button: {
    padding: '8px 10px',
    borderRadius: '8px',
    background: 'var(--accent)',
    color: 'var(--bg)',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
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
  top: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  name: {
    color: 'var(--text)',
    fontSize: '12px',
    fontWeight: 600,
  },
  meta: {
    color: 'var(--text-dim)',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  restoreBtn: {
    padding: '4px 8px',
    borderRadius: '6px',
    border: '1px solid rgba(255,184,48,0.3)',
    color: 'var(--amber)',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  empty: {
    color: 'var(--text-muted)',
    fontSize: '11px',
    lineHeight: 1.6,
  },
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

export default function SnapshotPanel() {
  const [items, setItems] = useState([])
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/snapshots', { headers: { Accept: 'application/json' } })
    if (!res.ok) return
    const data = await res.json()
    setItems(data.items || [])
  }, [])

  useEffect(() => { load().catch(() => {}) }, [load])

  const create = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      await fetch('/api/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ label: label.trim() }),
      })
      setLabel('')
      await load()
    } finally {
      setBusy(false)
    }
  }, [busy, label, load])

  const restore = useCallback(async (id) => {
    if (busy) return
    setBusy(true)
    try {
      await fetch(`/api/snapshots/${id}/restore`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      })
      await load()
    } finally {
      setBusy(false)
    }
  }, [busy, load])

  return (
    <section style={S.panel}>
      <div style={S.header}>
        <div style={S.title}>Snapshots</div>
        <button style={S.button} disabled={busy} onClick={create}>{busy ? 'Working...' : 'Create'}</button>
      </div>
      <div style={S.body}>
        <div style={S.row}>
          <input style={S.input} placeholder='Snapshot label (optional)' value={label} onChange={e => setLabel(e.target.value)} maxLength={120} />
        </div>

        {items.length === 0 && <div style={S.empty}>No snapshots yet. Create one before major agent changes.</div>}

        {items.slice(0, 8).map(item => (
          <article style={S.item} key={item.id}>
            <div style={S.top}>
              <div style={S.name}>{item.label}</div>
              <button style={S.restoreBtn} disabled={busy} onClick={() => restore(item.id)}>Restore</button>
            </div>
            <div style={S.meta}>{new Date(item.created_at).toLocaleString()} · {formatBytes(item.size_bytes || 0)}</div>
          </article>
        ))}
      </div>
    </section>
  )
}
