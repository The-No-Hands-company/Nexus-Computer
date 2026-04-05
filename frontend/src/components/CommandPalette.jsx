import { useEffect, useMemo, useRef, useState } from 'react'

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '12vh',
    zIndex: 40,
  },
  panel: {
    width: 'min(680px, calc(100vw - 24px))',
    border: '1px solid var(--border)',
    borderRadius: '14px',
    background: 'rgba(9, 12, 20, 0.96)',
    boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
    overflow: 'hidden',
  },
  inputWrap: {
    padding: '14px',
    borderBottom: '1px solid var(--border)',
  },
  input: {
    width: '100%',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    background: 'var(--bg-3)',
    color: 'var(--text)',
    padding: '12px 14px',
    fontSize: '14px',
    outline: 'none',
  },
  hintRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '10px 14px 0',
    color: 'var(--text-muted)',
    fontSize: '10px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  list: {
    maxHeight: '48vh',
    overflowY: 'auto',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  item: (active) => ({
    padding: '12px 12px',
    borderRadius: '10px',
    border: active ? '1px solid rgba(0,217,255,0.22)' : '1px solid transparent',
    background: active ? 'rgba(0,217,255,0.08)' : 'transparent',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  }),
  label: {
    color: 'var(--text)',
    fontSize: '13px',
    fontWeight: 600,
  },
  desc: {
    color: 'var(--text-dim)',
    fontSize: '11px',
    lineHeight: 1.5,
  },
  empty: {
    padding: '20px 14px',
    color: 'var(--text-muted)',
    fontSize: '12px',
  },
}

export default function CommandPalette({ open, onClose, commands }) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter(cmd => {
      const hay = `${cmd.label} ${cmd.description || ''} ${(cmd.keywords || []).join(' ')}`.toLowerCase()
      return hay.includes(q)
    })
  }, [commands, query])

  useEffect(() => {
    if (activeIndex >= filtered.length) setActiveIndex(Math.max(0, filtered.length - 1))
  }, [filtered.length, activeIndex])

  if (!open) return null

  const runCommand = (cmd) => {
    onClose()
    cmd.action?.()
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, filtered.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[activeIndex]) runCommand(filtered[activeIndex])
    }
  }

  return (
    <div style={S.overlay} onMouseDown={onClose}>
      <div style={S.panel} onMouseDown={e => e.stopPropagation()}>
        <div style={S.inputWrap}>
          <input
            ref={inputRef}
            style={S.input}
            placeholder="Search commands, actions, and shortcuts"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <div style={S.hintRow}>
            <span>Enter to run</span>
            <span>Esc to close</span>
          </div>
        </div>
        <div style={S.list}>
          {filtered.length === 0 && <div style={S.empty}>No commands match that search.</div>}
          {filtered.map((cmd, idx) => (
            <div
              key={cmd.id}
              style={S.item(idx === activeIndex)}
              onMouseEnter={() => setActiveIndex(idx)}
              onClick={() => runCommand(cmd)}
            >
              <div style={S.label}>{cmd.label}</div>
              {cmd.description && <div style={S.desc}>{cmd.description}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
