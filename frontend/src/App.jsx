import { useState, useCallback, useEffect, useMemo } from 'react'
import Header from './components/Header'
import FileExplorer from './components/FileExplorer'
import Chat from './components/Chat'
import Terminal from './components/Terminal'
import Login from './components/Login'
import CommunityPanel from './components/CommunityPanel'
import AccountPanel from './components/AccountPanel'
import PluginPanel from './components/PluginPanel'
import PersonasPanel from './components/PersonasPanel'
import CommandPalette from './components/CommandPalette'
import NetworkPanel from './components/NetworkPanel'
import ActionsPanel from './components/ActionsPanel'
import SnapshotPanel from './components/SnapshotPanel'
import ToolsHubPanel from './components/ToolsHubPanel'
import AutomationPanel from './components/AutomationPanel'
import HostedServicesPanel from './components/HostedServicesPanel'

const styles = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: 'var(--bg)',
    overflow: 'hidden',
  },
  workspace: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    borderTop: '1px solid var(--border)',
    gap: '0',
  },
  rail: {
    width: '280px',
    display: 'flex',
    flexDirection: 'column',
    minWidth: '220px',
    flexShrink: 0,
    background: 'var(--bg-2)',
  },
  stage: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    background: 'var(--bg)',
  },
  drawer: (open) => ({
    width: open ? '360px' : '44px',
    transition: 'width 0.2s ease',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-2)',
    borderLeft: '1px solid var(--border)',
    flexShrink: 0,
    overflow: 'hidden',
  }),
  footer: {
    height: '24px',
    borderTop: '1px solid var(--border-dim)',
    background: 'rgba(255,255,255,0.01)',
    color: 'var(--text-muted)',
    fontSize: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 12px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  topBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    borderBottom: '1px solid var(--border-dim)',
    background: 'rgba(255,255,255,0.01)',
    color: 'var(--text-dim)',
    fontSize: '10px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    gap: '8px',
    flexWrap: 'nowrap',
    overflowX: 'auto',
  },
  railHeader: {
    padding: '8px 12px',
    borderBottom: '1px solid var(--border-dim)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: 'var(--text-dim)',
    fontSize: '10px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    fontWeight: 700,
  },
  railActions: {
    display: 'flex',
    gap: '6px',
    padding: '8px 10px',
    borderBottom: '1px solid var(--border-dim)',
    flexWrap: 'wrap',
  },
  miniBtn: {
    padding: '4px 8px',
    borderRadius: '999px',
    border: '1px solid var(--border)',
    background: 'rgba(255,255,255,0.02)',
    color: 'var(--text-dim)',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    cursor: 'pointer',
  },
  drawerHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 10px',
    borderBottom: '1px solid var(--border-dim)',
    minHeight: '36px',
  },
  drawerTitle: {
    color: 'var(--text-dim)',
    fontSize: '10px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    fontWeight: 700,
  },
  drawerToggle: {
    width: '24px',
    height: '24px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    background: 'rgba(255,255,255,0.02)',
    color: 'var(--text-dim)',
    cursor: 'pointer',
  },
  tabs: {
    display: 'flex',
    gap: '6px',
    padding: '8px 10px',
    borderBottom: '1px solid var(--border-dim)',
    overflowX: 'auto',
  },
  tab: (active) => ({
    padding: '4px 8px',
    borderRadius: '999px',
    border: active ? '1px solid rgba(0,217,255,0.26)' : '1px solid var(--border)',
    background: active ? 'rgba(0,217,255,0.08)' : 'rgba(255,255,255,0.02)',
    color: active ? 'var(--accent)' : 'var(--text-dim)',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }),
  drawerBody: {
    flex: 1,
    overflowY: 'auto',
  },
  stack: {
    display: 'flex',
    flexDirection: 'column',
  },
  stackDivider: {
    height: '1px',
    background: 'var(--border)',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '14px',
    height: '14px',
    borderRadius: '999px',
    background: 'var(--red)',
    color: '#fff',
    fontSize: '9px',
    fontWeight: 700,
    lineHeight: 1,
    padding: '0 3px',
    marginLeft: '4px',
    verticalAlign: 'middle',
  },
  pill: {
    padding: '3px 8px',
    borderRadius: '999px',
    border: '1px solid var(--border)',
    background: 'rgba(255,255,255,0.02)',
  },
}

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedFile, setSelectedFile] = useState(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(true)
  const [activeTab, setActiveTab] = useState('personas')
  const [mainTab, setMainTab] = useState('chat') // 'chat' | 'terminal'

  // ── Auth state ──────────────────────────────────────────────────────────────
  const [authState, setAuthState] = useState('loading') // loading | setup | login | app

  useEffect(() => {
    fetch('/api/auth/status')
      .then(r => r.json())
      .then(({ configured }) => {
        if (!configured) { setAuthState('app'); return } // open mode
        const token = localStorage.getItem('nexus_token')
        setAuthState(token ? 'app' : 'login')
      })
      .catch(() => setAuthState('app'))
  }, [])

  const handleAuthDone = (token) => {
    if (token) localStorage.setItem('nexus_token', token)
    setAuthState('app')
  }

  // Show auth screens
  if (authState === 'loading') {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', color: 'var(--text-dim)', fontFamily: 'var(--font-brand)',
        fontSize: '12px', letterSpacing: '0.15em' }}>
        NEXUS INITIALIZING...
      </div>
    )
  }
  if (authState === 'setup') return <Login onDone={handleAuthDone} isSetup />
  if (authState === 'login') return <Login onDone={handleAuthDone} isSetup={false} />

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])
  const [unhealthyCount, setUnhealthyCount] = useState(0)

  useEffect(() => {
    const poll = () =>
      fetch('/api/services', { headers: { Accept: 'application/json' } })
        .then(r => r.ok ? r.json() : { items: [] })
        .then(data => {
          const count = (data.items || []).filter(
            s => s.status === 'running' && s.probe_healthy === false
          ).length
          setUnhealthyCount(count)
        })
        .catch(() => {})
    poll()
    const t = setInterval(poll, 5000)
    return () => clearInterval(t)
  }, [])

  const openTab = useCallback((tab) => {
    setActiveTab(tab)
    setDrawerOpen(true)
  }, [])

  const renderDrawerTab = useCallback(() => {
    if (activeTab === 'personas') return <PersonasPanel />
    if (activeTab === 'services') return <HostedServicesPanel />
    if (activeTab === 'automation') return <AutomationPanel />
    if (activeTab === 'actions') return <ActionsPanel />
    if (activeTab === 'snapshots') return <SnapshotPanel />
    if (activeTab === 'community') return <CommunityPanel />
    return (
      <div style={styles.stack}>
        <div data-panel="account"><AccountPanel /></div>
        <div style={styles.stackDivider} />
        <div data-panel="plugins"><PluginPanel /></div>
        <div style={styles.stackDivider} />
        <div data-panel="network"><NetworkPanel /></div>
        <div style={styles.stackDivider} />
        <div data-panel="tools-hub"><ToolsHubPanel /></div>
      </div>
    )
  }, [activeTab])

  const commands = useMemo(() => ([
    { id: 'new-chat', label: 'New chat', description: 'Clear the current conversation', keywords: ['chat', 'reset'], action: () => window.location.reload() },
    { id: 'refresh-workspace', label: 'Refresh workspace', description: 'Reload the file explorer and metadata', keywords: ['files', 'reload'], action: refresh },
    { id: 'open-community', label: 'Open community panel', description: 'Show feature voting in contextual drawer', keywords: ['community', 'requests'], action: () => openTab('community') },
    { id: 'open-files', label: 'Focus files rail', description: 'Bring workspace explorer into view', keywords: ['files', 'explorer'], action: () => document.querySelector('[data-panel="files"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) },
    { id: 'open-account', label: 'Open system panel', description: 'Show account and system controls', keywords: ['account', 'sessions'], action: () => openTab('system') },
    { id: 'open-personas', label: 'Open personas panel', description: 'Show persona presets and prompt controls', keywords: ['persona', 'prompts', 'system'], action: () => openTab('personas') },
    { id: 'open-plugins', label: 'Open system plugins', description: 'Show plugin installs', keywords: ['plugins', 'apps'], action: () => openTab('system') },
    { id: 'open-network', label: 'Open system network', description: 'Show federation network stats', keywords: ['network', 'federation', 'nodes', 'health'], action: () => openTab('system') },
    { id: 'open-services', label: 'Open hosted services', description: 'Start, stop, and monitor long-running apps', keywords: ['services', 'hosting', 'ports', 'processes'], action: () => openTab('services') },
    { id: 'open-automation', label: 'Open automation', description: 'Manage scheduled always-on jobs', keywords: ['automation', 'jobs', 'schedule', 'cron'], action: () => openTab('automation') },
    { id: 'open-actions', label: 'Open action ledger', description: 'Show recent tool events and results', keywords: ['actions', 'ledger', 'audit'], action: () => openTab('actions') },
    { id: 'open-snapshots', label: 'Open snapshots', description: 'Manage workspace backup and restore', keywords: ['snapshot', 'restore', 'backup'], action: () => openTab('snapshots') },
    { id: 'open-tools-hub', label: 'Open deployment panel', description: 'Review deployment and federation controls', keywords: ['tools', 'hub', 'standalone', 'cloud'], action: () => openTab('system') },
  ]), [refresh, openTab])

  return (
    <div style={styles.app}>
      <Header onOpenPalette={() => setPaletteOpen(true)} />
      <div style={styles.topBanner}>
        <span style={styles.pill}>Nexus.computer — self-hosted AI cloud computer</span>
        <span style={styles.pill}>Powered by Nexus AI</span>
        <span style={styles.pill}>Free · Open · Private</span>
      </div>
      <div style={styles.workspace}>
        <div style={styles.rail}>
          <div style={styles.railHeader}>
            <span>Workspace</span>
            <span>{selectedFile ? 'Focused' : 'Ready'}</span>
          </div>
          <div style={styles.railActions}>
            <button style={styles.miniBtn} onClick={() => openTab('personas')}>Personas</button>
            <button style={styles.miniBtn} onClick={() => openTab('services')}>Services</button>
            <button style={styles.miniBtn} onClick={() => openTab('automation')}>Automation</button>
            <button style={styles.miniBtn} onClick={() => openTab('actions')}>Actions</button>
            <button style={styles.miniBtn} onClick={() => openTab('snapshots')}>Snapshots</button>
            <button style={styles.miniBtn} onClick={() => openTab('system')}>System</button>
          </div>
          <div data-panel="files">
            <FileExplorer
              refreshKey={refreshKey}
              onFileSelect={setSelectedFile}
              selectedFile={selectedFile}
            />
          </div>
        </div>

        <div style={styles.stage}>
          {/* Main tab bar */}
          <div style={{
            display: 'flex', gap: '2px', padding: '0 12px', height: '36px',
            alignItems: 'center', background: 'var(--bg-2)',
            borderBottom: '1px solid var(--border)', flexShrink: 0,
          }}>
            {[['chat', '⬡ Chat'], ['terminal', '$ Terminal']].map(([t, label]) => (
              <button
                key={t}
                onClick={() => setMainTab(t)}
                style={{
                  padding: '4px 14px', borderRadius: 'var(--r)',
                  fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600,
                  color: mainTab === t ? 'var(--accent)' : 'var(--text-dim)',
                  background: mainTab === t ? 'var(--accent-glow)' : 'transparent',
                  border: mainTab === t ? '1px solid rgba(0,217,255,0.2)' : '1px solid transparent',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >{label}</button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div style={{ display: mainTab === 'chat' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
              <Chat
                selectedFile={selectedFile}
                onFsChange={refresh}
                onOpenPalette={() => setPaletteOpen(true)}
              />
            </div>
            <div style={{ display: mainTab === 'terminal' ? 'flex' : 'none', flex: 1, overflow: 'hidden' }}>
              <Terminal active={mainTab === 'terminal'} />
            </div>
          </div>
        </div>

        <div style={styles.drawer(drawerOpen)}>
          <div style={styles.drawerHeader}>
            {drawerOpen && <span style={styles.drawerTitle}>Context</span>}
            <button
              style={styles.drawerToggle}
              onClick={() => setDrawerOpen(o => !o)}
              title={drawerOpen ? 'Collapse drawer' : 'Expand drawer'}
            >
              {drawerOpen ? '›' : '‹'}
            </button>
          </div>

          {drawerOpen && (
            <>
              <div style={styles.tabs}>
                <button style={styles.tab(activeTab === 'personas')} onClick={() => setActiveTab('personas')}>Personas</button>
                <button style={styles.tab(activeTab === 'services')} onClick={() => setActiveTab('services')}>
                  Services{unhealthyCount > 0 && <span style={styles.badge}>{unhealthyCount}</span>}
                </button>
                <button style={styles.tab(activeTab === 'automation')} onClick={() => setActiveTab('automation')}>Automation</button>
                <button style={styles.tab(activeTab === 'actions')} onClick={() => setActiveTab('actions')}>Actions</button>
                <button style={styles.tab(activeTab === 'snapshots')} onClick={() => setActiveTab('snapshots')}>Snapshots</button>
                <button style={styles.tab(activeTab === 'system')} onClick={() => setActiveTab('system')}>System</button>
                <button style={styles.tab(activeTab === 'community')} onClick={() => setActiveTab('community')}>Community</button>
              </div>
              <div style={styles.drawerBody}>{renderDrawerTab()}</div>
            </>
          )}
        </div>
      </div>
      <div style={styles.footer}>
        <span>Free • Open • Private</span>
        <span>Uplink runtime: chat-dominant v2 layout</span>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
    </div>
  )
}
