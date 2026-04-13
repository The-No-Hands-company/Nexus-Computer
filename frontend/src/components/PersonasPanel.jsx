import { useCallback, useEffect, useState } from 'react'

const S = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-2)',
    minHeight: '240px',
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
  },
  card: (active) => ({
    border: active ? '1px solid rgba(61,255,160,0.3)' : '1px solid var(--border-dim)',
    borderRadius: '8px',
    padding: '8px 10px',
    background: active ? 'rgba(61,255,160,0.05)' : 'rgba(255,255,255,0.015)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  }),
  row: {
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
  desc: {
    color: 'var(--text-dim)',
    fontSize: '11px',
    lineHeight: 1.5,
  },
  prompt: {
    color: 'var(--text-muted)',
    fontSize: '10px',
    lineHeight: 1.4,
    maxHeight: '48px',
    overflow: 'hidden',
  },
  controls: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  button: (primary) => ({
    padding: '5px 9px',
    borderRadius: '6px',
    border: primary ? '1px solid rgba(0,217,255,0.24)' : '1px solid var(--border)',
    background: primary ? 'rgba(0,217,255,0.06)' : 'rgba(255,255,255,0.02)',
    color: primary ? 'var(--accent)' : 'var(--text-dim)',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    cursor: 'pointer',
  }),
  input: {
    background: 'var(--bg-3)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '6px 8px',
    color: 'var(--text)',
    fontSize: '11px',
  },
  textarea: {
    background: 'var(--bg-3)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '6px 8px',
    color: 'var(--text)',
    fontSize: '11px',
    minHeight: '64px',
    resize: 'vertical',
  },
  message: {
    color: 'var(--amber)',
    fontSize: '10px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
}

export default function PersonasPanel() {
  const [personas, setPersonas] = useState([])
  const [activeId, setActiveId] = useState('')
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/personas', { headers: { Accept: 'application/json' } })
    if (!res.ok) return
    const data = await res.json()
    setPersonas(data.items || [])
    setActiveId(data.active_persona_id || '')
  }, [])

  useEffect(() => { load().catch(() => {}) }, [load])

  const activate = useCallback(async (personaId) => {
    const res = await fetch(`/api/personas/${personaId}/activate`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      setMessage('Could not activate persona')
      return
    }
    const data = await res.json()
    setActiveId(data.active_persona_id)
    setMessage(`Active persona: ${data.active?.name || personaId}`)
  }, [])

  const create = useCallback(async () => {
    if (name.trim().length < 2 || systemPrompt.trim().length < 10) {
      setMessage('Name and prompt are required')
      return
    }
    const res = await fetch('/api/personas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim(),
        system_prompt: systemPrompt.trim(),
      }),
    })
    if (!res.ok) {
      setMessage('Could not create persona')
      return
    }
    setName('')
    setDescription('')
    setSystemPrompt('')
    setMessage('Persona created')
    await load()
  }, [name, description, systemPrompt, load])

  const remove = useCallback(async (personaId) => {
    const res = await fetch(`/api/personas/${personaId}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      setMessage('Could not delete persona')
      return
    }
    setMessage('Persona deleted')
    await load()
  }, [load])

  return (
    <section style={S.panel}>
      <div style={S.header}>
        <div style={S.title}>Personas</div>
        <div style={S.title}>{personas.length} total</div>
      </div>
      <div style={S.body}>
        {message && <div style={S.message}>{message}</div>}

        {personas.map(persona => (
          <article key={persona.id} style={S.card(persona.id === activeId)}>
            <div style={S.row}>
              <div style={S.name}>{persona.name}</div>
              <div style={S.controls}>
                <button style={S.button(true)} onClick={() => activate(persona.id)}>
                  Activate
                </button>
                {!persona.is_builtin && (
                  <button style={S.button(false)} onClick={() => remove(persona.id)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
            <div style={S.desc}>{persona.description || 'No description'}</div>
            <div style={S.prompt}>{persona.system_prompt}</div>
          </article>
        ))}

        <article style={S.card(false)}>
          <div style={S.name}>Create Persona</div>
          <input
            placeholder="Name"
            style={S.input}
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <input
            placeholder="Description"
            style={S.input}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
          <textarea
            placeholder="System prompt"
            style={S.textarea}
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
          />
          <div style={S.controls}>
            <button style={S.button(true)} onClick={create}>Create</button>
          </div>
        </article>
      </div>
    </section>
  )
}
