import { useState, useRef, useEffect, useCallback } from 'react'

/* ── icons ── */
const SendIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)

const TerminalIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="4 17 10 11 4 5"/>
    <line x1="12" y1="19" x2="20" y2="19"/>
  </svg>
)

const FileIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
    <polyline points="13 2 13 9 20 9"/>
  </svg>
)

const SearchIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)

/* ── styles ── */
const S = {
  panel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: 'var(--bg)',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  welcome: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: '12px',
    color: 'var(--text-dim)',
    paddingBottom: '40px',
  },
  welcomeTitle: {
    fontFamily: 'var(--font-brand)',
    fontSize: '24px',
    fontWeight: 900,
    color: 'var(--accent)',
    textShadow: '0 0 40px rgba(0,217,255,0.4)',
    letterSpacing: '0.2em',
  },
  welcomeSub: {
    fontSize: '12px',
    color: 'var(--text-dim)',
    letterSpacing: '0.08em',
    maxWidth: '420px',
    textAlign: 'center',
    lineHeight: 1.8,
  },
  prompts: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    justifyContent: 'center',
    marginTop: '8px',
  },
  promptChip: {
    padding: '6px 14px',
    border: '1px solid var(--border)',
    borderRadius: '20px',
    fontSize: '11px',
    color: 'var(--text-dim)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    background: 'transparent',
  },
  msg: (role) => ({
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    alignItems: role === 'user' ? 'flex-end' : 'flex-start',
    maxWidth: '100%',
  }),
  msgRole: (role) => ({
    fontSize: '10px',
    letterSpacing: '0.1em',
    color: role === 'user' ? 'var(--accent-dim)' : 'var(--text-muted)',
    textTransform: 'uppercase',
    marginBottom: '2px',
  }),
  msgBubble: (role) => ({
    maxWidth: '80%',
    padding: '10px 14px',
    borderRadius: role === 'user' ? '12px 12px 2px 12px' : '2px 12px 12px 12px',
    background: role === 'user' ? 'rgba(0,217,255,0.08)' : 'var(--bg-2)',
    border: role === 'user' ? '1px solid rgba(0,217,255,0.2)' : '1px solid var(--border)',
    color: 'var(--text)',
    fontSize: '13px',
    lineHeight: 1.7,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }),
  toolBlock: (type) => ({
    padding: '8px 12px',
    borderRadius: '4px',
    border: `1px solid ${type === 'use' ? 'rgba(255,184,48,0.3)' : 'rgba(61,255,160,0.2)'}`,
    background: type === 'use' ? 'rgba(255,184,48,0.05)' : 'rgba(61,255,160,0.04)',
    fontSize: '11px',
    lineHeight: 1.6,
    maxWidth: '80%',
  }),
  toolHeader: (type) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: type === 'use' ? 'var(--amber)' : 'var(--green)',
    marginBottom: '4px',
    fontWeight: 500,
    letterSpacing: '0.05em',
  }),
  toolBody: {
    color: 'var(--text-dim)',
    fontFamily: 'var(--font-mono)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    maxHeight: '120px',
    overflowY: 'auto',
  },
  inputArea: {
    borderTop: '1px solid var(--border)',
    padding: '14px 20px',
    background: 'var(--bg-2)',
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-end',
  },
  inputWrap: {
    flex: 1,
    background: 'var(--bg-3)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'flex-end',
    padding: '8px 12px',
    gap: '8px',
    transition: 'border-color 0.2s',
  },
  textarea: {
    flex: 1,
    resize: 'none',
    fontSize: '13px',
    lineHeight: 1.6,
    color: 'var(--text)',
    background: 'transparent',
    maxHeight: '160px',
    overflow: 'auto',
  },
  sendBtn: (disabled) => ({
    width: '34px',
    height: '34px',
    borderRadius: '6px',
    background: disabled ? 'var(--bg-3)' : 'var(--accent)',
    color: disabled ? 'var(--text-muted)' : 'var(--bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.15s',
    cursor: disabled ? 'not-allowed' : 'pointer',
  }),
  thinking: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    background: 'var(--bg-2)',
    border: '1px solid var(--border)',
    borderRadius: '2px 12px 12px 12px',
    color: 'var(--text-dim)',
    fontSize: '12px',
    width: 'fit-content',
  },
  dots: {
    display: 'flex',
    gap: '3px',
  },
  fileContext: {
    padding: '6px 12px',
    background: 'rgba(0,217,255,0.05)',
    border: '1px solid rgba(0,217,255,0.15)',
    borderRadius: '4px',
    fontSize: '11px',
    color: 'var(--accent-dim)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '8px',
  },
  searchContext: {
    padding: '6px 12px',
    background: 'rgba(255,184,48,0.06)',
    border: '1px solid rgba(255,184,48,0.18)',
    borderRadius: '4px',
    fontSize: '11px',
    color: 'var(--amber)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '8px',
  },
  miniRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginBottom: '8px',
    color: 'var(--text-dim)',
    fontSize: '10px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  searchInput: {
    flex: 1,
    background: 'var(--bg-3)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '8px 10px',
    color: 'var(--text)',
    fontSize: '12px',
  },
}

const QUICK_PROMPTS = [
  'Show me what\'s in the workspace',
  'Create a hello world script',
  'Install Python and run a test',
  'Set up a simple web server',
]

/* ── Thinking dots ── */
function ThinkingDots() {
  return (
    <div style={S.thinking}>
      <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-brand)', fontSize: '10px', letterSpacing: '0.1em' }}>
        NEXUS
      </span>
      <div style={S.dots}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: '4px', height: '4px', borderRadius: '50%',
            background: 'var(--accent)',
            animation: `bounce 1.2s ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
    </div>
  )
}

/* ── Tool event block ── */
function ToolBlock({ event }) {
  const isUse = event.type === 'tool_use'
  const label = isUse
    ? `$ ${event.name}${event.input?.command ? `: ${event.input.command.slice(0, 60)}` : ''}`
    : `✓ ${event.name}`
  const body = isUse
    ? (event.input ? JSON.stringify(event.input, null, 2) : '')
    : (event.result || '')

  return (
    <div style={S.toolBlock(isUse ? 'use' : 'result')}>
      <div style={S.toolHeader(isUse ? 'use' : 'result')}>
        <TerminalIcon />
        <span>{label}</span>
      </div>
      {body && <div style={S.toolBody}>{body}</div>}
    </div>
  )
}

/* ── Message ── */
function Message({ msg }) {
  if (msg.role === 'tool') return <ToolBlock event={msg} />

  return (
    <div style={S.msg(msg.role)}>
      <div style={S.msgRole(msg.role)}>
        {msg.role === 'user' ? 'You' : 'Nexus'}
      </div>
      <div style={S.msgBubble(msg.role)}>{msg.content}</div>
    </div>
  )
}

/* ── Main Chat ── */
export default function Chat({ selectedFile, onFsChange }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [search, setSearch] = useState('')
  const [meta, setMeta] = useState(null)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      @keyframes bounce {
        0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
        40% { transform: translateY(-4px); opacity: 1; }
      }
    `
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    fetch('/api/meta')
      .then(r => r.json())
      .then(setMeta)
      .catch(() => setMeta(null))
  }, [])

  const buildApiMessages = useCallback((msgs) => {
    return msgs
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }))
  }, [])

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || streaming) return

    const userMsg = { role: 'user', content: text.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setStreaming(true)

    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    let assistantText = ''
    let assistantMsgAdded = false

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ messages: buildApiMessages(newMessages), search: search.trim() || null }),
      })

      if (!response.ok || !response.body) {
        throw new Error(`Request failed (${response.status})`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))

            if (event.type === 'text') {
              assistantText += event.content
              setMessages(prev => {
                const copy = [...prev]
                if (!assistantMsgAdded) {
                  copy.push({ role: 'assistant', content: assistantText })
                  assistantMsgAdded = true
                } else {
                  copy[copy.length - 1] = { role: 'assistant', content: assistantText }
                }
                return copy
              })
            } else if (event.type === 'tool_use' || event.type === 'tool_result') {
              setMessages(prev => [...prev, { role: 'tool', ...event }])
              if (event.type === 'tool_result') onFsChange?.()
            } else if (event.type === 'done') {
              break
            }
          } catch {
            continue
          }
        }
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Connection error: ${e.message}. Is the backend running?`,
      }])
    } finally {
      setStreaming(false)
    }
  }, [messages, streaming, buildApiMessages, onFsChange, search])

  const handleKey = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }, [input, sendMessage])

  const handleInput = useCallback((e) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
  }, [])

  const isEmpty = messages.length === 0

  return (
    <div style={S.panel}>
      <div style={S.messages}>
        {isEmpty ? (
          <div style={S.welcome}>
            <div style={S.welcomeTitle}>NEXUS</div>
            <div style={S.welcomeSub}>
              Your free, private cloud computer. Ask me to build apps, inspect files,
              run commands, or search the workspace.
            </div>
            <div style={S.miniRow}>
              <SearchIcon />
              <span>Workspace search</span>
            </div>
            <input
              style={S.searchInput}
              placeholder="Search workspace before chat..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div style={S.prompts}>
              {QUICK_PROMPTS.map(p => (
                <button
                  key={p}
                  style={S.promptChip}
                  onClick={() => sendMessage(p)}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--accent-dim)'
                    e.currentTarget.style.color = 'var(--accent)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.color = 'var(--text-dim)'
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
            {meta?.values?.[0] && (
              <div style={{ color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '0.08em' }}>
                {meta.values.join(' • ')}
              </div>
            )}
          </div>
        ) : (
          messages.map((msg, i) => <Message key={i} msg={msg} />)
        )}
        {streaming && messages[messages.length - 1]?.role !== 'assistant' && (
          <ThinkingDots />
        )}
        <div ref={bottomRef} />
      </div>

      <div style={S.inputArea}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {selectedFile && (
            <div style={S.fileContext}>
              <FileIcon />
              <span>Context: {selectedFile.name}</span>
            </div>
          )}
          {search.trim() && (
            <div style={S.searchContext}>
              <SearchIcon />
              <span>Search: {search.trim()}</span>
            </div>
          )}
          <div
            style={S.inputWrap}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--accent-dim)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <textarea
              ref={textareaRef}
              style={S.textarea}
              placeholder="Talk to Nexus... (Enter to send, Shift+Enter for newline)"
              value={input}
              onChange={handleInput}
              onKeyDown={handleKey}
              rows={1}
              disabled={streaming}
            />
          </div>
        </div>
        <button
          style={S.sendBtn(!input.trim() || streaming)}
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || streaming}
        >
          <SendIcon />
        </button>
      </div>
    </div>
  )
}
