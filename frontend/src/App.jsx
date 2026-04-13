import { useState, useCallback, useMemo } from 'react'
import Header from './components/Header'
import FileExplorer from './components/FileExplorer'
import Chat from './components/Chat'
import CommunityPanel from './components/CommunityPanel'
import AccountPanel from './components/AccountPanel'
import PluginPanel from './components/PluginPanel'
import PersonasPanel from './components/PersonasPanel'
import CommandPalette from './components/CommandPalette'
import NetworkPanel from './components/NetworkPanel'
import ActionsPanel from './components/ActionsPanel'
import SnapshotPanel from './components/SnapshotPanel'
import ToolsHubPanel from './components/ToolsHubPanel'

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
  },
  leftColumn: {
    width: '260px',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    flexShrink: 0,
  },
  middleColumn: {
    width: '340px',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    flexShrink: 0,
    background: 'var(--bg-2)',
  },
  subDivider: {
    height: '1px',
    background: 'var(--border)',
    flexShrink: 0,
  },
  divider: {
    width: '1px',
    background: 'var(--border)',
    flexShrink: 0,
  },
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
    flexWrap: 'wrap',
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

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  const commands = useMemo(() => ([
    { id: 'new-chat', label: 'New chat', description: 'Clear the current conversation', keywords: ['chat', 'reset'], action: () => window.location.reload() },
    { id: 'refresh-workspace', label: 'Refresh workspace', description: 'Reload the file explorer and metadata', keywords: ['files', 'reload'], action: refresh },
    { id: 'open-community', label: 'Focus community requests', description: 'Move attention to feature voting', keywords: ['community', 'requests'], action: () => document.querySelector('[data-panel="community"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) },
    { id: 'open-files', label: 'Focus files', description: 'Bring the workspace explorer into view', keywords: ['files', 'explorer'], action: () => document.querySelector('[data-panel="files"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) },
    { id: 'open-account', label: 'Focus account', description: 'Show account and session controls', keywords: ['account', 'sessions'], action: () => document.querySelector('[data-panel="account"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) },
    { id: 'open-personas', label: 'Focus personas', description: 'Show persona presets and prompt controls', keywords: ['persona', 'prompts', 'system'], action: () => document.querySelector('[data-panel="personas"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) },
    { id: 'open-plugins', label: 'Focus plugins', description: 'Show plugin installs', keywords: ['plugins', 'apps'], action: () => document.querySelector('[data-panel="plugins"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) },
    { id: 'open-network', label: 'Focus network health', description: 'Show Nexus federation network stats', keywords: ['network', 'federation', 'nodes', 'health'], action: () => document.querySelector('[data-panel="network"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) },
    { id: 'open-actions', label: 'Focus action ledger', description: 'Show recent tool events and results', keywords: ['actions', 'ledger', 'audit'], action: () => document.querySelector('[data-panel="actions"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) },
    { id: 'open-snapshots', label: 'Focus snapshots', description: 'Manage workspace snapshot and restore', keywords: ['snapshot', 'restore', 'backup'], action: () => document.querySelector('[data-panel="snapshots"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) },
    { id: 'open-tools-hub', label: 'Focus tools hub', description: 'Review scaffolded Nexus tools and apps', keywords: ['tools', 'hub', 'standalone', 'cloud'], action: () => document.querySelector('[data-panel="tools-hub"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) },
  ]), [refresh])

  return (
    <div style={styles.app}>
      <Header onOpenPalette={() => setPaletteOpen(true)} />
      <div style={styles.topBanner}>
        <span style={styles.pill}>Nexus Cloud: central operating hub</span>
        <span style={styles.pill}>Modes: standalone + hub-integrated</span>
        <span style={styles.pill}>Session: persistent workspace</span>
      </div>
      <div style={styles.workspace}>
        <div style={styles.leftColumn}>
          <div data-panel="files">
            <FileExplorer
              refreshKey={refreshKey}
              onFileSelect={setSelectedFile}
              selectedFile={selectedFile}
            />
          </div>
          <div style={styles.subDivider} />
          <div data-panel="account">
            <AccountPanel />
          </div>
          <div style={styles.subDivider} />
          <div data-panel="personas">
            <PersonasPanel />
          </div>
          <div style={styles.subDivider} />
          <div data-panel="plugins">
            <PluginPanel />
          </div>
          <div style={styles.subDivider} />
          <div data-panel="community">
            <CommunityPanel />
          </div>
          <div style={styles.subDivider} />
          <div data-panel="network" style={{ flex: 1, minHeight: 0 }}>
            <NetworkPanel />
          </div>
        </div>
        <div style={styles.divider} />
        <div style={styles.middleColumn}>
          <div data-panel="actions">
            <ActionsPanel />
          </div>
          <div style={styles.subDivider} />
          <div data-panel="snapshots">
            <SnapshotPanel />
          </div>
          <div style={styles.subDivider} />
          <div data-panel="tools-hub" style={{ flex: 1, minHeight: 0 }}>
            <ToolsHubPanel />
          </div>
        </div>
        <div style={styles.divider} />
        <Chat
          selectedFile={selectedFile}
          onFsChange={refresh}
          onOpenPalette={() => setPaletteOpen(true)}
        />
      </div>
      <div style={styles.footer}>
        <span>Free • Open • Private</span>
        <span>Workspace-backed AI computer</span>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
    </div>
  )
}
