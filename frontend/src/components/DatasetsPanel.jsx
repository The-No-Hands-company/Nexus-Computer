import { useEffect, useState, useCallback } from 'react'

/* Datasets are named collections of files in the workspace, tagged and
   described so Nexus AI can reference them by name in conversations.
   Stored in /workspace/.nexus/datasets.json */

async function loadDatasets() {
  const res = await fetch('/api/files/read?path=.nexus/datasets.json').catch(() => null)
  if (!res?.ok) return []
  const data = await res.json().catch(() => null)
  if (!data?.content) return []
  try { return JSON.parse(data.content).items || [] } catch { return [] }
}

async function saveDatasets(items) {
  await fetch('/api/files/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: '.nexus/datasets.json', content: JSON.stringify({ items }, null, 2) }),
  })
}

const TYPES = [
  { value: 'files', label: 'Files / Docs' },
  { value: 'code', label: 'Code' },
  { value: 'data', label: 'Data (CSV/JSON)' },
  { value: 'logs', label: 'Logs' },
  { value: 'notes', label: 'Notes' },
  { value: 'other', label: 'Other' },
]

const TYPE_COLORS = {
  files: 'var(--accent)',
  code: 'var(--green)',
  data: 'var(--amber)',
  logs: 'var(--red)',
  notes: '#c084fc',
  other: 'var(--text-dim)',
}

const S = {
  wrap: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' },
  header: {
    padding: '12px 16px', borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
  },
  title: { fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700 },
  body: { padding: '12px', display: 'flex', flexDirection: 'column', gap: 12 },
  form: {
    padding: '14px', background: 'var(--bg-2)', border: '1px solid var(--border)',
    borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 10,
  },
  label: { fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 3 },
  input: {
    width: '100%', padding: '8px 10px', background: 'var(--bg-3)',
    border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', fontSize: 12,
  },
  textarea: {
    width: '100%', padding: '8px 10px', background: 'var(--bg-3)',
    border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', fontSize: 12,
    resize: 'vertical', minHeight: 60, fontFamily: 'var(--font-mono)',
  },
  select: {
    width: '100%', padding: '8px 10px', background: 'var(--bg-3)',
    border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', fontSize: 12,
  },
  btnRow: { display: 'flex', gap: 8 },
  saveBtn: {
    padding: '7px 16px', borderRadius: 4, background: 'var(--accent)', color: 'var(--bg)',
    fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
  },
  cancelBtn: {
    padding: '7px 16px', borderRadius: 4, background: 'transparent', color: 'var(--text-dim)',
    fontSize: 11, cursor: 'pointer', border: '1px solid var(--border)',
  },
  card: {
    padding: '12px', background: 'var(--bg-3)', border: '1px solid var(--border)',
    borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 6,
  },
  cardTop: { display: 'flex', alignItems: 'center', gap: 8 },
  typeBadge: (type) => ({
    fontSize: 9, padding: '2px 7px', borderRadius: 10, fontWeight: 600,
    color: TYPE_COLORS[type] || 'var(--text-dim)',
    background: `${TYPE_COLORS[type] || 'var(--text-dim)'}18`,
    border: `1px solid ${TYPE_COLORS[type] || 'var(--text-dim)'}33`,
    letterSpacing: '0.08em', textTransform: 'uppercase',
  }),
  cardName: { fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 },
  cardDesc: { fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 },
  cardPath: { fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' },
  cardActions: { display: 'flex', gap: 6, marginTop: 2 },
  actionBtn: {
    padding: '4px 10px', fontSize: 10, cursor: 'pointer', borderRadius: 4, border: '1px solid var(--border)',
    background: 'transparent', color: 'var(--text-dim)', transition: 'all 0.15s',
  },
  delBtn: {
    padding: '4px 10px', fontSize: 10, cursor: 'pointer', borderRadius: 4,
    border: '1px solid rgba(255,77,106,0.3)', background: 'transparent', color: 'var(--red)',
  },
  empty: { fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '30px 0', lineHeight: 1.8 },
  sLabel: { fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 },
}

export default function DatasetsPanel({ onUseDataset }) {
  const [items, setItems] = useState([])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', path: '', type: 'files', description: '' })
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => { loadDatasets().then(setItems) }, [])

  const save = useCallback(async () => {
    if (!form.name.trim() || !form.path.trim()) return
    setSaving(true)
    const item = {
      id: `ds-${Date.now()}`,
      name: form.name.trim(),
      path: form.path.trim(),
      type: form.type,
      description: form.description.trim(),
      created_at: new Date().toISOString(),
    }
    const next = [item, ...items]
    await saveDatasets(next).catch(() => {})
    setItems(next)
    setForm({ name: '', path: '', type: 'files', description: '' })
    setAdding(false)
    setSaving(false)
  }, [form, items])

  const del = useCallback(async (id) => {
    const next = items.filter(i => i.id !== id)
    await saveDatasets(next).catch(() => {})
    setItems(next)
  }, [items])

  const use = useCallback((item) => {
    onUseDataset?.(`Using dataset "${item.name}" at path: ${item.path}\n\nPlease list and describe the files in this dataset.`)
  }, [onUseDataset])

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <span style={S.title}>Datasets</span>
        <button
          style={{ fontSize: 10, color: 'var(--accent)', cursor: 'pointer' }}
          onClick={() => setAdding(a => !a)}
        >{adding ? 'Cancel' : '+ New dataset'}</button>
      </div>

      <div style={S.body}>
        {adding && (
          <div style={S.form}>
            <div>
              <label style={S.label}>Name</label>
              <input style={S.input} placeholder="My dataset" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={S.label}>Workspace path</label>
              <input style={S.input} placeholder="data/my-files or logs/app" value={form.path}
                onChange={e => setForm(f => ({ ...f, path: e.target.value }))} />
            </div>
            <div>
              <label style={S.label}>Type</label>
              <select style={S.select} value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Description (optional)</label>
              <textarea style={S.textarea} placeholder="What's in this dataset?"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div style={S.btnRow}>
              <button style={S.saveBtn} onClick={save} disabled={saving}>
                {saving ? 'Saving...' : 'Save dataset'}
              </button>
              <button style={S.cancelBtn} onClick={() => setAdding(false)}>Cancel</button>
            </div>
          </div>
        )}

        {items.length === 0 && !adding ? (
          <div style={S.empty}>
            No datasets yet.<br />
            Create a dataset to give Nexus AI<br />
            named access to your files.
          </div>
        ) : (
          <div>
            <div style={S.sLabel}>Your datasets</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(item => (
                <div key={item.id} style={S.card}>
                  <div style={S.cardTop}>
                    <span style={S.typeBadge(item.type)}>{item.type}</span>
                    <span style={S.cardName}>{item.name}</span>
                  </div>
                  <div style={S.cardPath}>{item.path}</div>
                  {item.description && <div style={S.cardDesc}>{item.description}</div>}
                  <div style={S.cardActions}>
                    <button style={S.actionBtn}
                      onClick={() => use(item)}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-dim)'; e.currentTarget.style.color = 'var(--accent)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}
                    >Use in chat</button>
                    <button style={S.delBtn} onClick={() => del(item.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
