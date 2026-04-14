import { useCallback, useEffect, useState } from 'react'

const S = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-2)',
    minHeight: '280px',
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
  },
  card: {
    border: '1px solid var(--border-dim)',
    borderRadius: '8px',
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.015)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
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
  status: (running) => ({
    color: running ? 'var(--green)' : 'var(--text-dim)',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: 700,
  }),
  detail: {
    color: 'var(--text-dim)',
    fontSize: '11px',
    lineHeight: 1.5,
    fontFamily: 'var(--font-mono)',
    wordBreak: 'break-all',
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
  message: {
    color: 'var(--amber)',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  logs: {
    border: '1px solid var(--border-dim)',
    borderRadius: '8px',
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.015)',
    maxHeight: '220px',
    overflowY: 'auto',
  },
}

export default function HostedServicesPanel() {
  const [services, setServices] = useState([])
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [logs, setLogs] = useState([])
  const [message, setMessage] = useState('')

  const [name, setName] = useState('')
  const [command, setCommand] = useState('')
  const [port, setPort] = useState('')
  const [cwd, setCwd] = useState('')
  const [autostart, setAutostart] = useState(false)
  const [probePath, setProbePath] = useState('/')
  const [expectedStatus, setExpectedStatus] = useState('200')
  const [probeInterval, setProbeInterval] = useState('30')
  const [probeTimeout, setProbeTimeout] = useState('2')

  const loadServices = useCallback(async () => {
    const res = await fetch('/api/services', { headers: { Accept: 'application/json' } })
    if (!res.ok) return
    const data = await res.json()
    setServices(data.items || [])
  }, [])

  const loadLogs = useCallback(async (serviceId) => {
    if (!serviceId) {
      setLogs([])
      return
    }
    const res = await fetch(`/api/services/${serviceId}/logs?lines=120`, { headers: { Accept: 'application/json' } })
    if (!res.ok) return
    const data = await res.json()
    setLogs(data.lines || [])
  }, [])

  useEffect(() => {
    loadServices().catch(() => {})
    const t = setInterval(() => loadServices().catch(() => {}), 4000)
    return () => clearInterval(t)
  }, [loadServices])

  useEffect(() => {
    loadLogs(selectedServiceId).catch(() => {})
  }, [selectedServiceId, loadLogs])

  const createService = useCallback(async () => {
    if (name.trim().length < 2 || command.trim().length < 1) {
      setMessage('Name and command are required')
      return
    }
    const res = await fetch('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        command: command.trim(),
        port: port ? Number(port) : null,
        cwd: cwd.trim(),
        autostart,
        probe_path: probePath.trim() || '/',
        expected_status: Number(expectedStatus) || 200,
        probe_interval_seconds: Number(probeInterval) || 30,
        probe_timeout_seconds: Number(probeTimeout) || 2,
      }),
    })
    if (!res.ok) {
      setMessage('Could not create service')
      return
    }
    setName('')
    setCommand('')
    setPort('')
    setCwd('')
    setAutostart(false)
    setProbePath('/')
    setExpectedStatus('200')
    setProbeInterval('30')
    setProbeTimeout('2')
    setMessage('Service created')
    await loadServices()
  }, [name, command, port, cwd, autostart, probePath, expectedStatus, probeInterval, probeTimeout, loadServices])


  const serviceAction = useCallback(async (service, action) => {
    const res = await fetch(`/api/services/${service.id}/${action}`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      setMessage(`Could not ${action} service`)
      return
    }
    setMessage(`${service.name}: ${action}`)
    await loadServices()
    if (selectedServiceId === service.id) {
      await loadLogs(service.id)
    }
  }, [loadServices, loadLogs, selectedServiceId])

  const deleteService = useCallback(async (service) => {
    const res = await fetch(`/api/services/${service.id}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      setMessage('Could not delete service')
      return
    }
    if (selectedServiceId === service.id) {
      setSelectedServiceId('')
      setLogs([])
    }
    setMessage(`${service.name}: deleted`)
    await loadServices()
  }, [loadServices, selectedServiceId])

  return (
    <section style={S.panel}>
      <div style={S.header}>
        <div style={S.title}>Hosted Services</div>
        <div style={S.title}>{services.length} services</div>
      </div>
      <div style={S.body}>
        {message && <div style={S.message}>{message}</div>}

        {services.map(service => {
          const running = service.status === 'running'
          return (
            <article style={S.card} key={service.id}>
              <div style={S.row}>
                <div style={S.name}>{service.name}</div>
                <div style={S.status(running)}>{running ? 'running' : 'stopped'}</div>
              </div>
              <div style={S.detail}>{service.command}</div>
              <div style={S.detail}>
                Port: {service.port || 'n/a'} ({service.port_open ? 'open' : 'closed'}) • PID: {service.pid || 'n/a'}
              </div>
              <div style={S.detail}>
                Uptime: {service.uptime_seconds || 0}s • Probe: {(service.probe_path || '/')}
                {' '}→ {service.expected_status || 200}
                {' '}• Healthy: {service.probe_healthy === null ? 'n/a' : (service.probe_healthy ? 'yes' : 'no')}
              </div>
              <div style={S.detail}>
                Last probe: {service.last_probe_status_code || 'n/a'} in {service.last_probe_latency_ms || 'n/a'}ms
                {' '}• Failures: {service.probe_consecutive_failures || 0}
              </div>
              <div style={S.detail}>
                Avail: {service.availability_pct !== null && service.availability_pct !== undefined
                  ? `${service.availability_pct}%`
                  : 'n/a'}
                {' '}• Interval: {service.probe_interval_seconds || 30}s
                {' '}• Timeout: {service.probe_timeout_seconds || 2}s
                {service.last_success_at
                  ? ` • OK at: ${new Date(service.last_success_at).toLocaleTimeString()}`
                  : ''}
              </div>
              <div style={S.controls}>
                {!running && <button style={S.button(true)} onClick={() => serviceAction(service, 'start')}>Start</button>}
                {running && <button style={S.button(false)} onClick={() => serviceAction(service, 'stop')}>Stop</button>}
                <button style={S.button(false)} onClick={() => serviceAction(service, 'restart')}>Restart</button>
                <button style={S.button(false)} onClick={() => setSelectedServiceId(service.id)}>Logs</button>
                {service.port && running && (
                  <button style={S.button(false)} onClick={() => window.open(`http://127.0.0.1:${service.port}`, '_blank', 'noopener,noreferrer')}>
                    Open
                  </button>
                )}
                <button style={S.button(false)} onClick={() => deleteService(service)}>Delete</button>
              </div>
            </article>
          )
        })}

        <article style={S.card}>
          <div style={S.name}>Create hosted service</div>
          <input style={S.input} placeholder="Service name" value={name} onChange={e => setName(e.target.value)} />
          <input style={S.input} placeholder="Command (e.g. python -m http.server 9001)" value={command} onChange={e => setCommand(e.target.value)} />
          <input style={S.input} placeholder="Port (optional)" type="number" value={port} onChange={e => setPort(e.target.value)} />
          <input style={S.input} placeholder="Probe path (e.g. /health)" value={probePath} onChange={e => setProbePath(e.target.value)} />
          <input style={S.input} placeholder="Expected status" type="number" value={expectedStatus} onChange={e => setExpectedStatus(e.target.value)} />
          <input style={S.input} placeholder="Probe interval (seconds, default 30)" type="number" value={probeInterval} onChange={e => setProbeInterval(e.target.value)} />
          <input style={S.input} placeholder="Probe timeout (seconds, default 2)" type="number" value={probeTimeout} onChange={e => setProbeTimeout(e.target.value)} />
          <input style={S.input} placeholder="Working dir relative to workspace (optional)" value={cwd} onChange={e => setCwd(e.target.value)} />
          <label style={S.detail}>
            <input type="checkbox" checked={autostart} onChange={e => setAutostart(e.target.checked)} /> Autostart on Nexus launch
          </label>
          <div style={S.controls}>
            <button style={S.button(true)} onClick={createService}>Create service</button>
          </div>
        </article>

        <article style={S.logs}>
          <div style={S.name}>Service logs</div>
          {!selectedServiceId && <div style={S.detail}>Select a service and click Logs.</div>}
          {selectedServiceId && logs.length === 0 && <div style={S.detail}>No log lines yet.</div>}
          {logs.map((line, i) => (
            <div key={`${selectedServiceId}-${i}`} style={{ ...S.detail, marginTop: '4px' }}>{line}</div>
          ))}
        </article>
      </div>
    </section>
  )
}
