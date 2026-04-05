import { useState, useCallback, useMemo } from 'react'
import Header from './components/Header'
import FileExplorer from './components/FileExplorer'
import Chat from './components/Chat'
import CommunityPanel from './components/CommunityPanel'
import AccountPanel from './components/AccountPanel'
import PluginPanel from './components/PluginPanel'
import CommandPalette from './components/CommandPalette'

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
    overflow: 'hidden',
    flexShrink: 0,
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
    { id: 'open-plugins', label: 'Focus plugins', description: 'Show plugin installs', keywords: ['plugins', 'apps'], action: () => document.querySelector('[data-panel="plugins"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) },
  ]), [refresh])

  return (
    <div style={styles.app}>
      <Header onOpenPalette={() => setPaletteOpen(true)} />
      <div style={styles.topBanner}>
        <span style={styles.pill}>Session: persistent workspace</span>
        <span style={styles.pill}>Account: local-first shell</span>
        <span style={styles.pill}>Plugins: next layer ready</span>
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
          <div data-panel="plugins">
            <PluginPanel />
          </div>
          <div style={styles.subDivider} />
          <div data-panel="community">
            <CommunityPanel />
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
