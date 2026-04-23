import { useEffect, useRef, useCallback } from 'react'

const S = {
  wrap: {
    flex: 1, display: 'flex', flexDirection: 'column',
    background: '#0a0d14', overflow: 'hidden',
  },
  bar: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '6px 14px', background: 'var(--bg-2)',
    borderBottom: '1px solid var(--border)', flexShrink: 0,
  },
  dot: (c) => ({ width: 10, height: 10, borderRadius: '50%', background: c }),
  label: {
    fontFamily: 'var(--font-mono)', fontSize: '11px',
    color: 'var(--text-dim)', letterSpacing: '0.08em', marginLeft: 'auto',
  },
  term: { flex: 1, padding: '8px', overflow: 'hidden' },
  offline: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '12px',
    color: 'var(--text-dim)', fontSize: '12px', letterSpacing: '0.08em',
  },
}

function getToken() {
  return localStorage.getItem('nexus_token') || ''
}

export default function Terminal({ active }) {
  const containerRef = useRef(null)
  const termRef = useRef(null)
  const wsRef = useRef(null)
  const fitRef = useRef(null)
  const mountedRef = useRef(false)

  const connect = useCallback(async () => {
    if (!containerRef.current) return

    // Dynamically import xterm so it doesn't block the app bundle
    const { Terminal: XTerm } = await import('@xterm/xterm')
    const { FitAddon } = await import('@xterm/addon-fit')
    const { WebLinksAddon } = await import('@xterm/addon-web-links')
    await import('@xterm/xterm/css/xterm.css')

    // Clean up previous instance
    if (termRef.current) {
      termRef.current.dispose()
      termRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    const term = new XTerm({
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'block',
      theme: {
        background: '#0a0d14',
        foreground: '#c8d6e5',
        cursor: '#00d9ff',
        cursorAccent: '#05080f',
        selectionBackground: 'rgba(0,217,255,0.2)',
        black: '#05080f',
        red: '#ff4d6a',
        green: '#3dffa0',
        yellow: '#ffb830',
        blue: '#4da6ff',
        magenta: '#c084fc',
        cyan: '#00d9ff',
        white: '#c8d6e5',
        brightBlack: '#2a3d52',
        brightRed: '#ff6b85',
        brightGreen: '#5cffb2',
        brightYellow: '#ffc94d',
        brightBlue: '#66b8ff',
        brightMagenta: '#d09cff',
        brightCyan: '#33e0ff',
        brightWhite: '#e8f0f8',
      },
      scrollback: 5000,
      allowProposedApi: true,
    })

    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon())
    termRef.current = term
    fitRef.current = fit

    term.open(containerRef.current)
    fit.fit()

    // Connect WebSocket
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const token = getToken()
    const ws = new WebSocket(`${proto}//${host}/api/terminal?token=${encodeURIComponent(token)}`)
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws

    ws.onopen = () => {
      // Send initial size
      ws.send(JSON.stringify({ type: 'resize', rows: term.rows, cols: term.cols }))
    }

    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        term.write(new Uint8Array(e.data))
      } else {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }))
        } catch {
          term.write(e.data)
        }
      }
    }

    ws.onclose = (e) => {
      if (e.code === 4001) {
        term.write('\r\n\x1b[31m[Authentication failed — reconnect with valid token]\x1b[0m\r\n')
      } else {
        term.write('\r\n\x1b[33m[Connection closed — refresh to reconnect]\x1b[0m\r\n')
      }
    }

    ws.onerror = () => {
      term.write('\r\n\x1b[31m[WebSocket error — is Nexus.computer running?]\x1b[0m\r\n')
    }

    // Input: terminal → WebSocket
    term.onData(data => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(new TextEncoder().encode(data))
      }
    })

    // Resize
    const resizeObserver = new ResizeObserver(() => {
      try {
        fit.fit()
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', rows: term.rows, cols: term.cols }))
        }
      } catch { /* ignore */ }
    })
    resizeObserver.observe(containerRef.current)

    term._resizeObserver = resizeObserver
  }, [])

  useEffect(() => {
    if (active && !mountedRef.current) {
      mountedRef.current = true
      connect()
    } else if (active && termRef.current) {
      // Re-fit when tab becomes visible again
      setTimeout(() => { try { fitRef.current?.fit() } catch { /* ignore */ } }, 50)
    }
  }, [active, connect])

  useEffect(() => {
    return () => {
      termRef.current?._resizeObserver?.disconnect()
      termRef.current?.dispose()
      wsRef.current?.close()
    }
  }, [])

  return (
    <div style={S.wrap}>
      <div style={S.bar}>
        <div style={S.dot('#ff4d6a')} />
        <div style={S.dot('#ffb830')} />
        <div style={S.dot('#3dffa0')} />
        <span style={S.label}>nexus@workspace — bash</span>
      </div>
      <div ref={containerRef} style={S.term} />
    </div>
  )
}
