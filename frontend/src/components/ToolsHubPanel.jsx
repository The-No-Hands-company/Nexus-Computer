import { useCallback, useEffect, useState } from 'react'

const S = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-2)',
    minHeight: '320px',
    flex: 1,
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
  badge: {
    fontSize: '9px',
    padding: '2px 6px',
    borderRadius: '999px',
    border: '1px solid rgba(61,255,160,0.2)',
    color: 'var(--green)',
    background: 'rgba(61,255,160,0.04)',
    letterSpacing: '0.08em',
  },
  body: {
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    overflowY: 'auto',
    flex: 1,
  },
  section: {
    border: '1px solid var(--border-dim)',
    borderRadius: '8px',
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.015)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sectionTitle: {
    color: 'var(--text)',
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 0',
    borderTop: '1px solid var(--border-dim)',
    gap: '8px',
  },
  label: {
    color: 'var(--text-dim)',
    fontSize: '11px',
    fontWeight: 500,
  },
  value: {
    color: 'var(--accent)',
    fontSize: '11px',
    fontFamily: 'monospace',
    fontWeight: 600,
  },
  status: (active) => ({
    color: active ? 'var(--green)' : 'var(--amber)',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: 600,
  }),
  buttonGroup: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
    marginTop: '8px',
  },
  button: (primary) => ({
    padding: '6px 10px',
    borderRadius: '6px',
    border: primary ? '1px solid rgba(0,217,255,0.24)' : '1px solid var(--border)',
    background: primary ? 'rgba(0,217,255,0.06)' : 'rgba(255,255,255,0.02)',
    color: primary ? 'var(--accent)' : 'var(--text-dim)',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  }),
  message: {
    color: 'var(--green)',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    padding: '6px 8px',
    background: 'rgba(61,255,160,0.08)',
    border: '1px solid rgba(61,255,160,0.2)',
    borderRadius: '6px',
  },
  note: {
    color: 'var(--text-dim)',
    fontSize: '9px',
    lineHeight: 1.5,
  },
}

export default function ToolsHubPanel() {
  const [deployment, setDeployment] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const loadDeployment = useCallback(async () => {
    try {
      const res = await fetch('/api/deployment', {
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) return
      const data = await res.json()
      setDeployment(data)
    } catch (e) {
      console.error('Failed to load deployment:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDeployment()
    const interval = setInterval(loadDeployment, 5000)
    return () => clearInterval(interval)
  }, [loadDeployment])

  const switchMode = useCallback(async (newMode) => {
    try {
      const res = await fetch('/api/deployment/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ mode: newMode }),
      })
      if (!res.ok) {
        setMessage(`Failed to switch mode to ${newMode}`)
        return
      }
      const data = await res.json()
      setDeployment(data)
      setMessage(`Switched to ${newMode} mode`)
      setTimeout(() => setMessage(''), 3000)
    } catch (e) {
      console.error('Mode switch error:', e)
      setMessage('Mode switch failed')
    }
  }, [])

  const toggleFederation = useCallback(async (enabled) => {
    try {
      const res = await fetch('/api/deployment/federation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      if (!res.ok) {
        setMessage(`Failed to ${enabled ? 'enable' : 'disable'} federation`)
        return
      }
      const data = await res.json()
      setDeployment(data)
      setMessage(
        enabled
          ? `Federation enabled. Node ID: ${data.node_id}`
          : 'Federation disabled'
      )
      setTimeout(() => setMessage(''), 3000)
    } catch (e) {
      console.error('Federation toggle error:', e)
      setMessage('Federation toggle failed')
    }
  }, [])

  if (loading || !deployment) {
    return (
      <section style={S.panel}>
        <div style={S.header}>
          <div style={S.title}>Deployment & Federation</div>
        </div>
        <div style={S.body}>
          <div style={S.section}>Loading deployment info...</div>
        </div>
      </section>
    )
  }

  const deploymentMode = deployment.mode
  const federationEnabled = deployment.federation?.enabled
  const nodeId = deployment.node_id
  const hubConnected = deployment.hub?.connected

  return (
    <section style={S.panel}>
      <div style={S.header}>
        <div style={S.title}>Deployment & Federation</div>
        <div style={S.badge}>Nexus Computer</div>
      </div>
      <div style={S.body}>
        {message && <div style={S.message}>{message}</div>}

        {/* Deployment Mode Section */}
        <article style={S.section}>
          <div style={S.sectionTitle}>Deployment Mode</div>
          <div style={S.row}>
            <span style={S.label}>Current Mode</span>
            <span style={S.value}>{deploymentMode.toUpperCase()}</span>
          </div>
          <div style={S.row}>
            <span style={S.label}>Status</span>
            <span style={S.status(deploymentMode === 'standalone')}>
              {deploymentMode === 'standalone' ? 'SELF-HOSTED' : 'HUB-INTEGRATED'}
            </span>
          </div>
          <div style={S.note}>
            {deploymentMode === 'standalone'
              ? 'Running as a self-hosted instance with optional federation support'
              : 'Integrated into Nexus Cloud hub'}
          </div>
          <div style={S.buttonGroup}>
            <button
              style={S.button(deploymentMode === 'standalone')}
              onClick={() => switchMode('standalone')}
              disabled={deploymentMode === 'standalone'}
            >
              Standalone
            </button>
            <button
              style={S.button(deploymentMode === 'hub-integrated')}
              onClick={() => switchMode('hub-integrated')}
              disabled={deploymentMode === 'hub-integrated'}
            >
              Hub-Integrated
            </button>
          </div>
        </article>

        {/* Federation Section (Standalone mode only) */}
        {deploymentMode === 'standalone' && (
          <article style={S.section}>
            <div style={S.sectionTitle}>Federation & Networking</div>
            <div style={S.row}>
              <span style={S.label}>Federation</span>
              <span style={S.status(federationEnabled)}>
                {federationEnabled ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
            {federationEnabled && (
              <div style={S.row}>
                <span style={S.label}>Node ID</span>
                <span style={S.value}>{nodeId}</span>
              </div>
            )}
            <div style={S.note}>
              {federationEnabled
                ? 'This node is discoverable and can peer with other Nexus nodes'
                : 'Enable federation to join the Nexus peer-to-peer network'}
            </div>
            <div style={S.buttonGroup}>
              <button
                style={S.button(!federationEnabled)}
                onClick={() => toggleFederation(!federationEnabled)}
              >
                {federationEnabled ? 'Disable Federation' : 'Enable Federation'}
              </button>
            </div>
          </article>
        )}

        {/* Hub Connection Section (Hub mode only) */}
        {deploymentMode === 'hub-integrated' && (
          <article style={S.section}>
            <div style={S.sectionTitle}>Hub Connection</div>
            <div style={S.row}>
              <span style={S.label}>Connected</span>
              <span style={S.status(hubConnected)}>
                {hubConnected ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>
            {deployment.hub?.url && (
              <div style={S.row}>
                <span style={S.label}>Hub URL</span>
                <span style={S.value}>{deployment.hub.url}</span>
              </div>
            )}
            <div style={S.note}>
              This instance is integrated with Nexus Cloud. All features are synchronized with the hub.
            </div>
          </article>
        )}
      </div>
    </section>
  )
}
