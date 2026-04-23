import { useEffect, useState, useCallback } from 'react'

function fmt(bytes) {
  if (!bytes) return '0 B'
  const k = 1024, sizes = ['B','KB','MB','GB','TB']
  const i = Math.floor(Math.log(Math.max(1, bytes)) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function pctColor(p) {
  return p > 85 ? 'var(--red)' : p > 65 ? 'var(--amber)' : 'var(--accent)'
}

const S = {
  wrap: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' },
  header: {
    padding: '12px 16px', borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
  },
  title: { fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700 },
  body: { padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 },
  sLabel: { fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 },
  diskCard: {
    padding: '16px', background: 'var(--bg-3)', border: '1px solid var(--border)',
    borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 10,
  },
  diskRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
  diskVal: { fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text)' },
  diskSub: { fontSize: 11, color: 'var(--text-muted)' },
  track: { height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' },
  fill: (pct) => ({
    height: '100%', width: `${Math.min(100, pct)}%`,
    background: pctColor(pct), borderRadius: 4, transition: 'width 0.6s',
  }),
  row3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 },
  mini: {
    padding: '10px 12px', background: 'var(--bg-3)', border: '1px solid var(--border)',
    borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 4,
  },
  miniLabel: { fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' },
  miniVal: { fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text)' },
  dirRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '7px 10px', background: 'var(--bg-3)', border: '1px solid var(--border)',
    borderRadius: 4, fontSize: 12,
  },
  dirName: { color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 11 },
  dirSize: { color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 11 },
  empty: { fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' },
  btn: {
    padding: '7px 14px', border: '1px solid var(--border)', borderRadius: 4,
    background: 'transparent', color: 'var(--text-dim)', fontSize: 11, cursor: 'pointer',
    transition: 'all 0.15s', letterSpacing: '0.06em',
  },
}

export default function WorkspacePanel() {
  const [disk, setDisk] = useState(null)
  const [dirs, setDirs] = useState([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const meta = await fetch('/api/meta').then(r => r.json()).catch(() => null)
      if (meta?.disk) setDisk(meta.disk)
    } finally {
      setLoading(false)
    }
  }, [])

  const scanDirs = useCallback(async () => {
    setScanning(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Run: du -sh /* 2>/dev/null | sort -rh | head -15' }],
          model_id: 'nexus-ai',
        }),
      })
      // Parse SSE stream for the result
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let output = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = dec.decode(value)
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data:')) {
            try {
              const ev = JSON.parse(line.slice(5))
              if (ev.type === 'tool_result') output = ev.result || ''
            } catch {}
          }
        }
      }
      // Parse du output
      const parsed = output.split('\n')
        .filter(Boolean)
        .map(l => { const [size, ...rest] = l.split('\t'); return { size: size?.trim(), path: rest.join('\t')?.trim() } })
        .filter(d => d.size && d.path)
      setDirs(parsed)
    } finally {
      setScanning(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 12 }}>Loading...</div>

  const used = disk?.used || 0
  const total = disk?.total || 1
  const free = disk?.free || 0
  const pct = Math.round((used / total) * 100)

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <span style={S.title}>Workspace</span>
        <button style={{ ...S.btn, fontSize: 10 }} onClick={load}>Refresh</button>
      </div>

      <div style={S.body}>
        {/* Main disk card */}
        <div style={S.diskCard}>
          <div style={S.diskRow}>
            <div>
              <div style={S.diskVal}>{fmt(used)}</div>
              <div style={S.diskSub}>of {fmt(total)} used · {pct}%</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>{fmt(free)}</div>
              <div style={S.diskSub}>free</div>
            </div>
          </div>
          <div style={S.track}>
            <div style={S.fill(pct)} />
          </div>
        </div>

        {/* Breakdown */}
        <div style={S.row3}>
          {[
            { label: 'Used', val: fmt(used) },
            { label: 'Free', val: fmt(free) },
            { label: 'Total', val: fmt(total) },
          ].map(({ label, val }) => (
            <div key={label} style={S.mini}>
              <div style={S.miniLabel}>{label}</div>
              <div style={S.miniVal}>{val}</div>
            </div>
          ))}
        </div>

        {/* Directory scan */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={S.sLabel}>Largest directories</div>
            <button
              style={S.btn}
              onClick={scanDirs}
              disabled={scanning}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-dim)'; e.currentTarget.style.color = 'var(--accent)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}
            >{scanning ? 'Scanning...' : 'Scan'}</button>
          </div>
          {dirs.length === 0
            ? <div style={S.empty}>Click scan to analyze directory sizes</div>
            : dirs.map((d, i) => (
              <div key={i} style={{ ...S.dirRow, marginBottom: 4 }}>
                <span style={S.dirName}>{d.path}</span>
                <span style={S.dirSize}>{d.size}</span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}
