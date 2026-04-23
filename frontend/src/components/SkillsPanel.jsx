import { useEffect, useState, useCallback } from 'react'

/* Skills are reusable prompt templates + optional bash scripts stored in
   /workspace/.nexus/skills.json. They're the Nexus equivalent of zo.computer
   Skills — shareable, composable, and community-driven. */

const API = (path) => fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' } })

async function loadSkills() {
  const res = await fetch('/api/files/read?path=.nexus/skills.json').catch(() => null)
  if (!res?.ok) return []
  const data = await res.json().catch(() => null)
  if (!data?.content) return []
  return JSON.parse(data.content).items || []
}

async function saveSkills(items) {
  await fetch('/api/files/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: '.nexus/skills.json', content: JSON.stringify({ items }, null, 2) }),
  })
}

const BUILTINS = [
  {
    id: 'builtin-git-status',
    name: 'Git Status',
    description: 'Show git status and recent commits',
    prompt: 'Run git status and show the last 5 commits with git log --oneline -5',
    icon: '⎇',
    builtin: true,
  },
  {
    id: 'builtin-sys-info',
    name: 'System Info',
    description: 'Full system information snapshot',
    prompt: 'Show me: uptime, memory usage (free -h), disk usage (df -h), and top 5 processes by CPU',
    icon: '⚙',
    builtin: true,
  },
  {
    id: 'builtin-list-services',
    name: 'List Services',
    description: 'Show all running ports and services',
    prompt: 'List all listening ports with: ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null',
    icon: '⬡',
    builtin: true,
  },
  {
    id: 'builtin-pip-list',
    name: 'Python Packages',
    description: 'List installed Python packages',
    prompt: 'Run pip list and pip3 list to show installed Python packages',
    icon: '🐍',
    builtin: true,
  },
  {
    id: 'builtin-cleanup',
    name: 'Cleanup Workspace',
    description: 'Remove temp files and caches',
    prompt: 'Clean up: remove __pycache__, .pyc files, node_modules/.cache, and tmp files in the workspace. Show what was removed.',
    icon: '🧹',
    builtin: true,
  },
]

const S = {
  wrap: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' },
  header: {
    padding: '12px 16px', borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
  },
  title: { fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700 },
  body: { padding: '12px', display: 'flex', flexDirection: 'column', gap: 12 },
  sLabel: { fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 },
  card: (active) => ({
    padding: '12px', background: 'var(--bg-3)', border: `1px solid ${active ? 'rgba(0,217,255,0.3)' : 'var(--border)'}`,
    borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s',
    display: 'flex', flexDirection: 'column', gap: 6,
  }),
  cardTop: { display: 'flex', alignItems: 'center', gap: 8 },
  icon: { fontSize: 16, flexShrink: 0 },
  cardName: { fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 },
  cardDesc: { fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 },
  cardActions: { display: 'flex', gap: 6, marginTop: 4 },
  runBtn: {
    padding: '5px 12px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
    background: 'var(--accent)', color: 'var(--bg)', fontWeight: 700, border: 'none',
    transition: 'opacity 0.15s', letterSpacing: '0.06em',
  },
  delBtn: {
    padding: '5px 12px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
    background: 'transparent', color: 'var(--red)', border: '1px solid rgba(255,77,106,0.3)',
    transition: 'all 0.15s',
  },
  form: {
    padding: '14px', background: 'var(--bg-2)', border: '1px solid var(--border)',
    borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 10,
  },
  formLabel: { fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3, display: 'block' },
  input: {
    width: '100%', padding: '8px 10px', background: 'var(--bg-3)',
    border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', fontSize: 12,
  },
  textarea: {
    width: '100%', padding: '8px 10px', background: 'var(--bg-3)',
    border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', fontSize: 12,
    resize: 'vertical', minHeight: 80, fontFamily: 'var(--font-mono)',
  },
  saveBtn: {
    padding: '8px 16px', borderRadius: 4, background: 'var(--accent)', color: 'var(--bg)',
    fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', letterSpacing: '0.08em',
  },
  cancelBtn: {
    padding: '8px 16px', borderRadius: 4, background: 'transparent', color: 'var(--text-dim)',
    fontSize: 11, cursor: 'pointer', border: '1px solid var(--border)',
  },
}

export default function SkillsPanel({ onRunSkill }) {
  const [custom, setCustom] = useState([])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', prompt: '', icon: '⚡' })
  const [active, setActive] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadSkills().then(setCustom).catch(() => {})
  }, [])

  const save = useCallback(async () => {
    if (!form.name.trim() || !form.prompt.trim()) return
    setSaving(true)
    const item = {
      id: `custom-${Date.now()}`,
      name: form.name.trim(),
      description: form.description.trim(),
      prompt: form.prompt.trim(),
      icon: form.icon || '⚡',
      builtin: false,
      created_at: new Date().toISOString(),
    }
    const next = [item, ...custom]
    await saveSkills(next).catch(() => {})
    setCustom(next)
    setForm({ name: '', description: '', prompt: '', icon: '⚡' })
    setAdding(false)
    setSaving(false)
  }, [form, custom])

  const del = useCallback(async (id) => {
    const next = custom.filter(s => s.id !== id)
    await saveSkills(next).catch(() => {})
    setCustom(next)
  }, [custom])

  const run = useCallback((skill) => {
    onRunSkill?.(skill.prompt)
  }, [onRunSkill])

  const all = [...BUILTINS, ...custom]

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <span style={S.title}>Skills</span>
        <button
          style={{ fontSize: 10, color: 'var(--accent)', cursor: 'pointer', letterSpacing: '0.08em' }}
          onClick={() => setAdding(a => !a)}
        >{adding ? 'Cancel' : '+ New skill'}</button>
      </div>

      <div style={S.body}>
        {/* New skill form */}
        {adding && (
          <div style={S.form}>
            <div>
              <label style={S.formLabel}>Name</label>
              <input style={S.input} placeholder="e.g. Check logs" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={S.formLabel}>Description</label>
              <input style={S.input} placeholder="What does this skill do?" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label style={S.formLabel}>Prompt / command</label>
              <textarea style={S.textarea} placeholder="The prompt to send to Nexus AI, or a bash command to run..."
                value={form.prompt}
                onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={S.formLabel}>Icon</label>
                <input style={{ ...S.input, width: 60 }} value={form.icon}
                  onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={S.saveBtn} onClick={save} disabled={saving}>
                {saving ? 'Saving...' : 'Save skill'}
              </button>
              <button style={S.cancelBtn} onClick={() => setAdding(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Built-in skills */}
        <div>
          <div style={S.sLabel}>Built-in</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {BUILTINS.map(skill => (
              <div
                key={skill.id}
                style={S.card(active === skill.id)}
                onClick={() => setActive(active === skill.id ? null : skill.id)}
              >
                <div style={S.cardTop}>
                  <span style={S.icon}>{skill.icon}</span>
                  <span style={S.cardName}>{skill.name}</span>
                </div>
                <div style={S.cardDesc}>{skill.description}</div>
                {active === skill.id && (
                  <div style={S.cardActions}>
                    <button style={S.runBtn} onClick={(e) => { e.stopPropagation(); run(skill) }}>
                      ▶ Run
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Custom skills */}
        {custom.length > 0 && (
          <div>
            <div style={S.sLabel}>My skills</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {custom.map(skill => (
                <div
                  key={skill.id}
                  style={S.card(active === skill.id)}
                  onClick={() => setActive(active === skill.id ? null : skill.id)}
                >
                  <div style={S.cardTop}>
                    <span style={S.icon}>{skill.icon}</span>
                    <span style={S.cardName}>{skill.name}</span>
                  </div>
                  {skill.description && <div style={S.cardDesc}>{skill.description}</div>}
                  {active === skill.id && (
                    <div style={S.cardActions}>
                      <button style={S.runBtn} onClick={(e) => { e.stopPropagation(); run(skill) }}>▶ Run</button>
                      <button style={S.delBtn} onClick={(e) => { e.stopPropagation(); del(skill.id) }}>Delete</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
