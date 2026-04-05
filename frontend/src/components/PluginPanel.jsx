import { useCallback, useEffect, useState } from 'react'

const S = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    height: '240px',
    minHeight: '200px',
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
    border: '1px solid rgba(61,255,160,0.2)',
    color: 'var(--green)',
    background: 'rgba(61,255,160,0.04)',
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
  input: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--bg-3)',
    color: 'var(--text)',
    fontSize: '12px',
  },
  textarea: {
    width: '100%',
    minHeight: '56px',
    resize: 'none',
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--bg-3)',
    color: 'var(--text)',
    fontSize: '12px',
    lineHeight: 1.5,
  },
  button: (disabled) => ({
    padding: '8px 10px',
    borderRadius: '8px',
    background: disabled ? 'var(--bg-3)' : 'var(--accent)',
    color: disabled ? 'var(--text-muted)' : 'var(--bg)',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: disabled ? 'not-allowed' : 'pointer',
  }),
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    overflowY: 'auto',
    paddingTop: '4px',
    flex: 1,
    minHeight: 0,
  },
  item: {
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid var(--border-dim)',
    background: 'rgba(255,255,255,0.015)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  itemTitle: {
    color: 'var(--text)',
    fontSize: '12px',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  itemMeta: {
    color: 'var(--text-muted)',
    fontSize: '10px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  itemDetails: {
    color: 'var(--text-dim)',
    fontSize: '11px',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  empty: {
    color: 'var(--text-muted)',
    fontSize: '11px',
    lineHeight: 1.6,
    padding: '4px 0',
  },
  error: {
    color: 'var(--red)',
    fontSize: '11px',
    lineHeight: 1.4,
  },
}

export default function PluginPanel() {
  const [items, setItems] = useState([])
  const [name, setName] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [description, setDescription] = useState('')
  const [entrypoint, setEntrypoint] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/plugins', { headers: { Accept: 'application/json' } })
    const data = await res.json()
    setItems(data.items || [])
  }, [])

  useEffect(() => { load().catch(() => {}) }, [load])

  const submit = useCallback(async (e) => {
    e.preventDefault()
    if (!name.trim() || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/plugins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          source_url: sourceUrl.trim(),
          description: description.trim(),
          entrypoint: entrypoint.trim(),
        }),
      })
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      setName('')
      setSourceUrl('')
      setDescription('')
      setEntrypoint('')
      await load()
    } catch (err) {
      setError(err.message || 'Could not install plugin')
    } finally {
      setSubmitting(false)
    }
  }, [name, sourceUrl, description, entrypoint, submitting, load])

  return (
    <section style={S.panel}>
      <div style={S.header}>
        <div style={S.title}>Plugin installs</div>
        <div style={S.badge}>{items.length} installed</div>
      </div>
      <div style={S.body}>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input style={S.input} placeholder="Plugin name" value={name} onChange={e => setName(e.target.value)} maxLength={80} />
          <input style={S.input} placeholder="Source URL (optional)" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} />
          <input style={S.input} placeholder="Entrypoint (optional)" value={entrypoint} onChange={e => setEntrypoint(e.target.value)} />
          <textarea style={S.textarea} placeholder="What does this plugin do?" value={description} onChange={e => setDescription(e.target.value)} maxLength={400} />
          <button style={S.button(submitting || !name.trim())} disabled={submitting || !name.trim()}>
            {submitting ? 'Installing...' : 'Install plugin'}
          </button>
        </form>
        {error && <div style={S.error}>{error}</div>}
        <div style={S.list}>
          {items.length === 0 && <div style={S.empty}>No plugins installed yet.</div>}
          {items.slice(0, 3).map(item => (
            <article key={item.id} style={S.item}>
              <div style={S.itemTitle}>{item.name}</div>
              <div style={S.itemMeta}>{item.enabled ? 'enabled' : 'disabled'} · {item.source_url ? 'remote' : 'local'}</div>
              {item.description && <div style={S.itemDetails}>{item.description}</div>}
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
