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
  input: {
    background: 'var(--bg-3)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '6px 8px',
    color: 'var(--text)',
    fontSize: '11px',
  },
  tinyRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '6px 0',
    borderTop: '1px solid var(--border-dim)',
    fontSize: '10px',
    color: 'var(--text-dim)',
    lineHeight: 1.4,
  },
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
  code: {
    margin: 0,
    padding: '8px',
    borderRadius: '6px',
    border: '1px solid var(--border-dim)',
    background: 'rgba(255,255,255,0.02)',
    color: 'var(--text)',
    fontSize: '10px',
    lineHeight: 1.5,
    overflowX: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  tabRow: {
    display: 'flex',
    gap: '6px',
    marginBottom: '4px',
  },
  tab: (active) => ({
    padding: '5px 8px',
    borderRadius: '999px',
    border: active ? '1px solid rgba(0,217,255,0.26)' : '1px solid var(--border)',
    background: active ? 'rgba(0,217,255,0.08)' : 'rgba(255,255,255,0.02)',
    color: active ? 'var(--accent)' : 'var(--text-dim)',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    cursor: 'pointer',
  }),
  eventsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  eventItem: {
    border: '1px solid var(--border-dim)',
    borderRadius: '6px',
    background: 'rgba(255,255,255,0.02)',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  eventTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
  },
  eventType: {
    color: 'var(--text)',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: 700,
  },
  eventTime: {
    color: 'var(--text-muted)',
    fontSize: '10px',
    fontFamily: 'monospace',
  },
  eventBody: {
    color: 'var(--text-dim)',
    fontSize: '10px',
    lineHeight: 1.5,
  },
}

export default function ToolsHubPanel() {
  const [deployment, setDeployment] = useState(null)
  const [cloud, setCloud] = useState(null)
  const [registrations, setRegistrations] = useState([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [hubId, setHubId] = useState('')
  const [hubUrl, setHubUrl] = useState('')
  const [nodeToken, setNodeToken] = useState('')
  const [hubLabel, setHubLabel] = useState('')
  const [copiedEndpoint, setCopiedEndpoint] = useState(null)
  const [rotateId, setRotateId] = useState(null)
  const [rotateToken, setRotateToken] = useState('')
  const [cloudEvents, setCloudEvents] = useState([])
  const [sysTab, setSysTab] = useState('controls')

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

  const loadCloud = useCallback(async () => {
    try {
      const [d, r, a] = await Promise.all([
        fetch('/api/cloud/discovery', { headers: { Accept: 'application/json' } }),
        fetch('/api/cloud/registrations', { headers: { Accept: 'application/json' } }),
        fetch('/api/actions?limit=60', { headers: { Accept: 'application/json' } }),
      ])
      if (d.ok) {
        setCloud(await d.json())
      }
      if (r.ok) {
        const data = await r.json()
        setRegistrations(data.items || [])
      }
      if (a.ok) {
        const data = await a.json()
        const items = (data.items || []).filter((item) =>
          String(item.event_type || '').startsWith('cloud_')
        )
        setCloudEvents(items)
      }
    } catch (e) {
      console.error('Failed to load cloud state:', e)
    }
  }, [])

  useEffect(() => {
    loadDeployment()
    loadCloud()
    const interval = setInterval(loadDeployment, 5000)
    const cloudInterval = setInterval(loadCloud, 7000)
    return () => {
      clearInterval(interval)
      clearInterval(cloudInterval)
    }
  }, [loadDeployment, loadCloud])

  const registerHub = useCallback(async () => {
    if (!hubId.trim() || !hubUrl.trim() || !nodeToken.trim()) {
      setMessage('Hub ID, Hub URL, and Node Token are required')
      return
    }
    try {
      const res = await fetch('/api/cloud/registrations/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          hub_id: hubId.trim(),
          hub_url: hubUrl.trim(),
          node_token: nodeToken,
          label: hubLabel.trim(),
          rotated_by: 'local_operator',
        }),
      })
      if (!res.ok) {
        setMessage('Cloud registration failed')
        return
      }
      setMessage('Hub registered')
      setNodeToken('')
      await loadCloud()
      setTimeout(() => setMessage(''), 3000)
    } catch (e) {
      console.error('Cloud registration error:', e)
      setMessage('Cloud registration failed')
    }
  }, [hubId, hubUrl, nodeToken, hubLabel, loadCloud])

  const deregisterHub = useCallback(async (id) => {
    try {
      const res = await fetch(`/api/cloud/registrations/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) {
        setMessage('Cloud deregistration failed')
        return
      }
      setMessage(`Hub ${id} deregistered`)
      await loadCloud()
      setTimeout(() => setMessage(''), 3000)
    } catch (e) {
      console.error('Cloud deregistration error:', e)
      setMessage('Cloud deregistration failed')
    }
  }, [loadCloud])

  const copyEndpoint = useCallback((content, key = content) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedEndpoint(key)
      setTimeout(() => setCopiedEndpoint(null), 2000)
    }).catch(() => {})
  }, [])

  const rotateHubToken = useCallback(async (id) => {
    if (!rotateToken.trim()) return
    try {
      const res = await fetch(`/api/cloud/registrations/${encodeURIComponent(id)}/rotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ node_token: rotateToken }),
      })
      if (!res.ok) {
        setMessage('Token rotation failed')
        return
      }
      setMessage(`Token rotated for ${id}`)
      setRotateId(null)
      setRotateToken('')
      setTimeout(() => setMessage(''), 3000)
    } catch (e) {
      console.error('Token rotation error:', e)
      setMessage('Token rotation failed')
    }
  }, [rotateToken])

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
  const baseUrl = cloud?.base_url || ''
  const registerUrl = baseUrl ? `${baseUrl}/api/cloud/register` : '/api/cloud/register'
  const samplePayload = JSON.stringify({
    hub_id: 'nexusclaw-hub-1',
    hub_url: 'https://hub.nexus.example',
    node_token: 'replace-with-shared-token',
    label: 'My Nexus Computer',
  }, null, 2)
  const sampleCurl = [
    `curl -X POST \"${registerUrl}\"`,
    "  -H 'Content-Type: application/json'",
    `  -d '${samplePayload}'`,
  ].join('\n')
  const sampleSignedNode = [
    "import crypto from 'node:crypto'",
    "",
    `const url = '${registerUrl}'`,
    "const method = 'POST'",
    "const path = '/api/cloud/register'",
    "const body = JSON.stringify({",
    "  hub_id: 'nexusclaw-hub-1',",
    "  hub_url: 'https://hub.nexus.example',",
    "  node_token: 'replace-with-shared-token',",
    "  label: 'My Nexus Computer'",
    "})",
    "const ts = String(Math.floor(Date.now() / 1000))",
    "const secret = process.env.NEXUS_NODE_SECRET || 'replace-with-node-secret'",
    "const canonical = [method, path, ts, body].join('\\n')",
    "const sig = crypto.createHmac('sha256', secret).update(canonical).digest('hex')",
    "",
    "await fetch(url, {",
    "  method,",
    "  headers: {",
    "    'Content-Type': 'application/json',",
    "    'x-nexus-ts': ts,",
    "    'x-nexus-signature': `sha256=${sig}`",
    "  },",
    "  body,",
    "})",
  ].join('\n')
  const sampleSignedPython = [
    "import hashlib",
    "import hmac",
    "import json",
    "import time",
    "import requests",
    "",
    `url = '${registerUrl}'`,
    "method = 'POST'",
    "path = '/api/cloud/register'",
    "body = json.dumps({",
    "    'hub_id': 'nexusclaw-hub-1',",
    "    'hub_url': 'https://hub.nexus.example',",
    "    'node_token': 'replace-with-shared-token',",
    "    'label': 'My Nexus Computer'",
    "}, separators=(',', ':'))",
    "ts = str(int(time.time()))",
    "secret = 'replace-with-node-secret'",
    "canonical = '\\n'.join([method, path, ts, body]).encode('utf-8')",
    "sig = hmac.new(secret.encode('utf-8'), canonical, hashlib.sha256).hexdigest()",
    "",
    "requests.post(",
    "    url,",
    "    data=body,",
    "    headers={",
    "        'Content-Type': 'application/json',",
    "        'x-nexus-ts': ts,",
    "        'x-nexus-signature': f'sha256={sig}',",
    "    },",
    ")",
  ].join('\n')
  const sampleSignedRotateCmd = [
    "# Replace placeholders, then run",
    `BASE_URL=${baseUrl ? `'${baseUrl}'` : "'https://your-node.example'"}`,
    "NODE_SECRET='replace-with-node-secret'",
    "TS=$(date +%s)",
    "BODY='{" + "\"hub_id\":\"nexusclaw-hub-1\",\"node_token\":\"replace-with-new-token\"}" + "'",
    "CANONICAL=$(printf 'POST\\n/api/cloud/register/rotate\\n%s\\n%s' \"$TS\" \"$BODY\")",
    "SIG=$(printf '%s' \"$CANONICAL\" | openssl dgst -sha256 -hmac \"$NODE_SECRET\" -hex | sed 's/^.* //')",
    "curl -X POST \"$BASE_URL/api/cloud/register/rotate\" \\",
    "  -H 'Content-Type: application/json' \\",
    "  -H \"x-nexus-ts: $TS\" \\",
    "  -H \"x-nexus-signature: sha256=$SIG\" \\",
    "  -d \"$BODY\"",
  ].join('\n')
  const sampleSignedRotateNodeCmd = [
    "# Replace placeholders, then run (Node-only, no openssl)",
    `BASE_URL=${baseUrl ? `'${baseUrl}'` : "'https://your-node.example'"}`,
    "NODE_SECRET='replace-with-node-secret'",
    "TS=$(date +%s)",
    "BODY='{" + "\"hub_id\":\"nexusclaw-hub-1\",\"node_token\":\"replace-with-new-token\"}" + "'",
    "SIG=$(node -e 'const crypto=require(\"crypto\");const method=\"POST\";const path=\"/api/cloud/register/rotate\";const ts=process.argv[1];const body=process.argv[2];const secret=process.argv[3];const canonical=[method,path,ts,body].join(\"\\n\");process.stdout.write(crypto.createHmac(\"sha256\",secret).update(canonical).digest(\"hex\"));' \"$TS\" \"$BODY\" \"$NODE_SECRET\")",
    "curl -X POST \"$BASE_URL/api/cloud/register/rotate\" \\",
    "  -H 'Content-Type: application/json' \\",
    "  -H \"x-nexus-ts: $TS\" \\",
    "  -H \"x-nexus-signature: sha256=$SIG\" \\",
    "  -d \"$BODY\"",
  ].join('\n')
  const sampleSignedRotateJsFile = [
    "// rotate-sign-test.js",
    "import crypto from 'node:crypto'",
    "",
    `const baseUrl = process.env.NEXUS_BASE_URL || ${baseUrl ? `'${baseUrl}'` : "'https://your-node.example'"}`,
    "const path = '/api/cloud/register/rotate'",
    "const method = 'POST'",
    "const body = JSON.stringify({",
    "  hub_id: process.env.NEXUS_HUB_ID || 'nexusclaw-hub-1',",
    "  node_token: process.env.NEXUS_NEW_TOKEN || 'replace-with-new-token'",
    "})",
    "const ts = String(Math.floor(Date.now() / 1000))",
    "const secret = process.env.NEXUS_NODE_SECRET || 'replace-with-node-secret'",
    "const canonical = [method, path, ts, body].join('\\n')",
    "const sig = crypto.createHmac('sha256', secret).update(canonical).digest('hex')",
    "",
    "const res = await fetch(`${baseUrl}${path}`, {",
    "  method,",
    "  headers: {",
    "    'Content-Type': 'application/json',",
    "    'x-nexus-ts': ts,",
    "    'x-nexus-signature': `sha256=${sig}`",
    "  },",
    "  body,",
    "})",
    "",
    "const text = await res.text()",
    "console.log('status:', res.status)",
    "console.log('body:', text)",
    "",
    "// Run with: node rotate-sign-test.js",
  ].join('\n')

  return (
    <section style={S.panel}>
      <div style={S.header}>
        <div style={S.title}>Deployment & Federation</div>
        <div style={S.badge}>Nexus Computer</div>
      </div>
      <div style={S.body}>
        {message && <div style={S.message}>{message}</div>}

        <div style={S.tabRow}>
          <button style={S.tab(sysTab === 'controls')} onClick={() => setSysTab('controls')}>Controls</button>
          <button style={S.tab(sysTab === 'cloud-events')} onClick={() => setSysTab('cloud-events')}>Cloud Events</button>
        </div>

        {sysTab === 'cloud-events' && (
          <article style={S.section}>
            <div style={S.sectionTitle}>Cloud Events</div>
            <div style={S.note}>Filtered action-ledger stream for cloud_* events only.</div>
            <div style={S.eventsList}>
              {cloudEvents.length === 0 && <div style={S.note}>No cloud events yet.</div>}
              {cloudEvents.slice(0, 15).map((evt) => (
                <div key={evt.id} style={S.eventItem}>
                  <div style={S.eventTop}>
                    <span style={S.eventType}>{evt.event_type || 'cloud_event'}</span>
                    <span style={S.eventTime}>{new Date(evt.created_at).toLocaleTimeString()}</span>
                  </div>
                  <div style={S.eventBody}>{evt.result_preview || evt.tool_name || 'event'}</div>
                  <div style={S.eventBody}>hub: {evt.hub_id || 'n/a'}{evt.rotated_by ? ` · by: ${evt.rotated_by}` : ''}</div>
                </div>
              ))}
            </div>
          </article>
        )}

        {sysTab === 'controls' && (
          <>

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

        <article style={S.section}>
          <div style={S.sectionTitle}>Cloud Contract</div>
          <div style={S.row}>
            <span style={S.label}>Node ID</span>
            <span style={S.value}>{cloud?.node_id || 'loading...'}</span>
          </div>
          <div style={S.row}>
            <span style={S.label}>Spec</span>
            <span style={S.value}>{cloud?.spec || 'n/a'}</span>
          </div>
          <div style={S.row}>
            <span style={S.label}>Runtime Uptime</span>
            <span style={S.value}>{cloud?.runtime?.uptime_seconds ?? 0}s</span>
          </div>
          <div style={S.row}>
            <span style={S.label}>Running / Unhealthy</span>
            <span style={S.value}>
              {(cloud?.runtime?.running_services ?? 0)} / {(cloud?.runtime?.unhealthy_services ?? 0)}
            </span>
          </div>
          {cloud?.base_url && (
            <>
              <div style={S.row}>
                <span style={S.label}>Discovery</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={S.value}>/.well-known/nexus-cloud</span>
                  <button
                    style={S.button(copiedEndpoint === `${cloud.base_url}/.well-known/nexus-cloud`)}
                    onClick={() => copyEndpoint(`${cloud.base_url}/.well-known/nexus-cloud`, `${cloud.base_url}/.well-known/nexus-cloud`)}
                  >
                    {copiedEndpoint === `${cloud.base_url}/.well-known/nexus-cloud` ? 'Copied!' : 'Copy'}
                  </button>
                </span>
              </div>
              <div style={S.row}>
                <span style={S.label}>Register endpoint</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={S.value}>/api/cloud/register</span>
                  <button
                    style={S.button(copiedEndpoint === `${cloud.base_url}/api/cloud/register`)}
                    onClick={() => copyEndpoint(`${cloud.base_url}/api/cloud/register`, `${cloud.base_url}/api/cloud/register`)}
                  >
                    {copiedEndpoint === `${cloud.base_url}/api/cloud/register` ? 'Copied!' : 'Copy'}
                  </button>
                </span>
              </div>
              <div style={{ ...S.row, alignItems: 'flex-start' }}>
                <span style={S.label}>Payload template</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    style={S.button(copiedEndpoint === 'cloud-register-payload')}
                    onClick={() => copyEndpoint(samplePayload, 'cloud-register-payload')}
                  >
                    {copiedEndpoint === 'cloud-register-payload' ? 'Copied!' : 'Copy JSON'}
                  </button>
                </span>
              </div>
              <pre style={S.code}>{samplePayload}</pre>
              <div style={{ ...S.row, alignItems: 'flex-start' }}>
                <span style={S.label}>cURL quickstart</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    style={S.button(copiedEndpoint === 'cloud-register-curl')}
                    onClick={() => copyEndpoint(sampleCurl, 'cloud-register-curl')}
                  >
                    {copiedEndpoint === 'cloud-register-curl' ? 'Copied!' : 'Copy cURL'}
                  </button>
                </span>
              </div>
              <pre style={S.code}>{sampleCurl}</pre>
              <div style={{ ...S.row, alignItems: 'flex-start' }}>
                <span style={S.label}>Signed callback (Node)</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    style={S.button(copiedEndpoint === 'cloud-register-node-sign')}
                    onClick={() => copyEndpoint(sampleSignedNode, 'cloud-register-node-sign')}
                  >
                    {copiedEndpoint === 'cloud-register-node-sign' ? 'Copied!' : 'Copy Node'}
                  </button>
                </span>
              </div>
              <pre style={S.code}>{sampleSignedNode}</pre>
              <div style={{ ...S.row, alignItems: 'flex-start' }}>
                <span style={S.label}>Signed callback (Python)</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    style={S.button(copiedEndpoint === 'cloud-register-python-sign')}
                    onClick={() => copyEndpoint(sampleSignedPython, 'cloud-register-python-sign')}
                  >
                    {copiedEndpoint === 'cloud-register-python-sign' ? 'Copied!' : 'Copy Python'}
                  </button>
                </span>
              </div>
              <pre style={S.code}>{sampleSignedPython}</pre>
              <div style={{ ...S.row, alignItems: 'flex-start' }}>
                <span style={S.label}>Signed rotate test</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    style={S.button(copiedEndpoint === 'cloud-register-rotate-test')}
                    onClick={() => copyEndpoint(sampleSignedRotateCmd, 'cloud-register-rotate-test')}
                  >
                    {copiedEndpoint === 'cloud-register-rotate-test' ? 'Copied!' : 'Copy Test Cmd'}
                  </button>
                </span>
              </div>
              <pre style={S.code}>{sampleSignedRotateCmd}</pre>
              <div style={{ ...S.row, alignItems: 'flex-start' }}>
                <span style={S.label}>Signed rotate test (Node)</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    style={S.button(copiedEndpoint === 'cloud-register-rotate-node-test')}
                    onClick={() => copyEndpoint(sampleSignedRotateNodeCmd, 'cloud-register-rotate-node-test')}
                  >
                    {copiedEndpoint === 'cloud-register-rotate-node-test' ? 'Copied!' : 'Copy Node Cmd'}
                  </button>
                </span>
              </div>
              <pre style={S.code}>{sampleSignedRotateNodeCmd}</pre>
              <div style={{ ...S.row, alignItems: 'flex-start' }}>
                <span style={S.label}>rotate-sign-test.js</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    style={S.button(copiedEndpoint === 'cloud-register-rotate-js-file')}
                    onClick={() => copyEndpoint(sampleSignedRotateJsFile, 'cloud-register-rotate-js-file')}
                  >
                    {copiedEndpoint === 'cloud-register-rotate-js-file' ? 'Copied!' : 'Copy JS File'}
                  </button>
                </span>
              </div>
              <pre style={S.code}>{sampleSignedRotateJsFile}</pre>
            </>
          )}
          <div style={S.note}>
            Published via /.well-known/nexus-cloud and /api/cloud/discovery for Nexus hub/node interoperability.
          </div>
        </article>

        <article style={S.section}>
          <div style={S.sectionTitle}>Hub Registration</div>
          <input
            style={S.input}
            placeholder="Hub ID (e.g. nexusclaw-hub-1)"
            value={hubId}
            onChange={e => setHubId(e.target.value)}
          />
          <input
            style={S.input}
            placeholder="Hub URL (e.g. https://hub.nexus.example)"
            value={hubUrl}
            onChange={e => setHubUrl(e.target.value)}
          />
          <input
            style={S.input}
            placeholder="Node token"
            type="password"
            value={nodeToken}
            onChange={e => setNodeToken(e.target.value)}
          />
          <input
            style={S.input}
            placeholder="Label (optional)"
            value={hubLabel}
            onChange={e => setHubLabel(e.target.value)}
          />
          <div style={S.buttonGroup}>
            <button style={S.button(true)} onClick={registerHub}>Register Hub</button>
          </div>
          <div style={S.note}>Token is submitted once; backend stores only a hash.</div>

          {registrations.length > 0 && registrations.map((reg) => (
            <div key={reg.id || reg.hub_id} style={{ ...S.tinyRow, flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{reg.hub_id}</div>
                  <div style={{ color: 'var(--text-muted)' }}>{reg.hub_url}</div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    style={S.button(rotateId === reg.hub_id)}
                    onClick={() => { setRotateId(rotateId === reg.hub_id ? null : reg.hub_id); setRotateToken('') }}
                  >
                    Rotate Token
                  </button>
                  <button style={S.button(false)} onClick={() => deregisterHub(reg.hub_id)}>Deregister</button>
                </div>
              </div>
              {rotateId === reg.hub_id && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  <input
                    style={{ ...S.input, flex: 1 }}
                    type="password"
                    placeholder="New node token"
                    value={rotateToken}
                    onChange={e => setRotateToken(e.target.value)}
                  />
                  <button style={S.button(true)} onClick={() => rotateHubToken(reg.hub_id)}>Confirm</button>
                </div>
              )}
            </div>
          ))}
          {registrations.length === 0 && (
            <div style={S.note}>No hub registrations yet.</div>
          )}
        </article>
          </>
        )}
      </div>
    </section>
  )
}
