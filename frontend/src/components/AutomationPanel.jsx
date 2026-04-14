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
  status: (state) => ({
    color: state === 'ok' ? 'var(--green)' : state === 'error' ? 'var(--red)' : 'var(--text-dim)',
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
  textarea: {
    background: 'var(--bg-3)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '6px 8px',
    color: 'var(--text)',
    fontSize: '11px',
    minHeight: '52px',
    resize: 'vertical',
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

export default function AutomationPanel() {
  const [jobs, setJobs] = useState([])
  const [logs, setLogs] = useState([])
  const [name, setName] = useState('')
  const [command, setCommand] = useState('')
  const [intervalSeconds, setIntervalSeconds] = useState('300')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    const [jobsRes, logsRes] = await Promise.all([
      fetch('/api/automation/jobs', { headers: { Accept: 'application/json' } }),
      fetch('/api/automation/logs?limit=20', { headers: { Accept: 'application/json' } }),
    ])
    if (jobsRes.ok) {
      const data = await jobsRes.json()
      setJobs(data.items || [])
    }
    if (logsRes.ok) {
      const data = await logsRes.json()
      setLogs(data.items || [])
    }
  }, [])

  useEffect(() => {
    load().catch(() => {})
    const t = setInterval(() => load().catch(() => {}), 5000)
    return () => clearInterval(t)
  }, [load])

  const create = useCallback(async () => {
    if (name.trim().length < 2 || command.trim().length < 1) {
      setMessage('Name and command are required')
      return
    }
    const res = await fetch('/api/automation/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        command: command.trim(),
        interval_seconds: Number(intervalSeconds) || 300,
        enabled: true,
      }),
    })
    if (!res.ok) {
      setMessage('Could not create job')
      return
    }
    setName('')
    setCommand('')
    setIntervalSeconds('300')
    setMessage('Job created')
    await load()
  }, [name, command, intervalSeconds, load])

  const toggle = useCallback(async (job) => {
    const res = await fetch(`/api/automation/jobs/${job.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ enabled: !job.enabled }),
    })
    if (!res.ok) {
      setMessage('Could not update job')
      return
    }
    await load()
  }, [load])

  const runNow = useCallback(async (job) => {
    const res = await fetch(`/api/automation/jobs/${job.id}/run`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      setMessage('Could not run job')
      return
    }
    setMessage(`Ran ${job.name}`)
    await load()
  }, [load])

  const remove = useCallback(async (job) => {
    const res = await fetch(`/api/automation/jobs/${job.id}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      setMessage('Could not delete job')
      return
    }
    setMessage(`Deleted ${job.name}`)
    await load()
  }, [load])

  return (
    <section style={S.panel}>
      <div style={S.header}>
        <div style={S.title}>Automation</div>
        <div style={S.title}>{jobs.length} jobs</div>
      </div>
      <div style={S.body}>
        {message && <div style={S.message}>{message}</div>}

        {jobs.map(job => (
          <article style={S.card} key={job.id}>
            <div style={S.row}>
              <div style={S.name}>{job.name}</div>
              <div style={S.status(job.last_status || 'idle')}>{job.last_status || 'idle'}</div>
            </div>
            <div style={S.detail}>{job.command}</div>
            <div style={S.detail}>Every {job.interval_seconds}s • Next {job.next_run_at || 'n/a'}</div>
            <div style={S.controls}>
              <button style={S.button(true)} onClick={() => runNow(job)}>Run now</button>
              <button style={S.button(false)} onClick={() => toggle(job)}>{job.enabled ? 'Disable' : 'Enable'}</button>
              <button style={S.button(false)} onClick={() => remove(job)}>Delete</button>
            </div>
          </article>
        ))}

        <article style={S.card}>
          <div style={S.name}>Create scheduled job</div>
          <input style={S.input} placeholder="Job name" value={name} onChange={e => setName(e.target.value)} />
          <textarea style={S.textarea} placeholder="Command to run" value={command} onChange={e => setCommand(e.target.value)} />
          <input style={S.input} type="number" min="30" value={intervalSeconds} onChange={e => setIntervalSeconds(e.target.value)} />
          <div style={S.controls}>
            <button style={S.button(true)} onClick={create}>Create job</button>
          </div>
        </article>

        <article style={S.logs}>
          <div style={S.name}>Recent runs</div>
          {logs.length === 0 && <div style={S.detail}>No runs yet.</div>}
          {logs.map(log => (
            <div key={log.id} style={{ ...S.detail, marginTop: '6px' }}>
              [{log.status}] {log.job_name} • {log.created_at}
            </div>
          ))}
        </article>
      </div>
    </section>
  )
}
