import { useEffect, useState } from 'react'

const S = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
    height: '52px',
    background: 'var(--bg-2)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  scanline: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,217,255,0.015) 2px, rgba(0,217,255,0.015) 4px)',
    pointerEvents: 'none',
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logo: {
    fontFamily: 'var(--font-brand)',
    fontSize: '15px',
    fontWeight: 900,
    letterSpacing: '0.15em',
    color: 'var(--accent)',
    textShadow: '0 0 20px rgba(0,217,255,0.5)',
    userSelect: 'none',
  },
  dot: {
    color: 'var(--text-dim)',
    fontFamily: 'var(--font-brand)',
    fontSize: '15px',
    fontWeight: 400,
  },
  tld: {
    color: 'var(--text-dim)',
    fontFamily: 'var(--font-brand)',
    fontSize: '13px',
    fontWeight: 400,
    letterSpacing: '0.1em',
  },
  badge: {
    fontSize: '9px',
    fontWeight: 600,
    letterSpacing: '0.15em',
    padding: '2px 7px',
    borderRadius: '2px',
    background: 'rgba(0,217,255,0.08)',
    border: '1px solid var(--accent-dim)',
    color: 'var(--accent-dim)',
    textTransform: 'uppercase',
    marginLeft: '4px',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '11px',
    color: 'var(--text-dim)',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  pill: {
    padding: '3px 8px',
    borderRadius: '999px',
    border: '1px solid var(--border)',
    background: 'rgba(255,255,255,0.02)',
    color: 'var(--text)',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    fontSize: '9px',
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '3px 8px',
    borderRadius: '999px',
    border: '1px solid var(--border-dim)',
    background: 'rgba(255,255,255,0.015)',
    color: 'var(--text-dim)',
    maxWidth: '340px',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },
  status: (online) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: online ? 'var(--green)' : 'var(--red)',
  }),
  statusDot: (online) => ({
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: online ? 'var(--green)' : 'var(--red)',
    boxShadow: online ? '0 0 8px var(--green)' : '0 0 8px var(--red)',
    animation: online ? 'pulse 2s infinite' : 'none',
  }),
}

const pulse = `@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}`

export default function Header() {
  const [online, setOnline] = useState(false)
  const [time, setTime] = useState(new Date())
  const [meta, setMeta] = useState(null)

  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = pulse
    document.head.appendChild(style)

    fetch('/api/health')
      .then(r => r.ok ? setOnline(true) : setOnline(false))
      .catch(() => setOnline(false))

    fetch('/api/meta')
      .then(r => r.json())
      .then(setMeta)
      .catch(() => setMeta(null))

    const tick = setInterval(() => setTime(new Date()), 1000)
    return () => { clearInterval(tick); document.head.removeChild(style) }
  }, [])

  const timeStr = time.toLocaleTimeString('en-GB', { hour12: false })
  const metaLine = meta ? `${meta.values?.join(' · ') || meta.name}` : 'private workspace'

  return (
    <header style={S.header}>
      <div style={S.scanline} />
      <div style={S.left}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '1px' }}>
          <span style={S.logo}>NEXUS</span>
          <span style={S.dot}>.</span>
          <span style={S.tld}>computer</span>
        </div>
        <span style={S.badge}>Production</span>
      </div>

      <div style={S.right}>
        <span style={S.pill}>Free • Open • Private</span>
        <span style={S.meta} title={metaLine}>
          {meta?.name || 'Nexus'}
        </span>
        <div style={S.status(online)}>
          <div style={S.statusDot(online)} />
          {online ? 'ONLINE' : 'OFFLINE'}
        </div>
        <span style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
          {timeStr}
        </span>
      </div>
    </header>
  )
}
