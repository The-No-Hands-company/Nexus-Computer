import { useState } from 'react'

const RELEASES = [
  {
    version: '0.3.0',
    date: 'April 2026',
    label: 'latest',
    changes: [
      { type: 'feat', text: 'Nexus AI integration — sole AI provider, no external keys required' },
      { type: 'feat', text: 'PTY terminal — full interactive bash shell in the browser' },
      { type: 'feat', text: 'Auth layer — single-user JWT password protection for self-hosted deployments' },
      { type: 'feat', text: 'Skills panel — reusable prompt templates with built-in and custom skills' },
      { type: 'feat', text: 'Datasets panel — named file collections for AI context' },
      { type: 'feat', text: 'Workspace panel — disk usage, storage overview, directory scanner' },
      { type: 'feat', text: 'Home dashboard — node stats, Nexus AI status, quick actions' },
      { type: 'fix', text: 'Removed Anthropic dependency entirely — Nexus AI handles all fallbacks' },
      { type: 'fix', text: 'TopBanner placeholder text replaced with real copy' },
    ],
  },
  {
    version: '0.2.0',
    date: 'April 2026',
    label: null,
    changes: [
      { type: 'feat', text: 'Multi-model support and routing via model registry' },
      { type: 'feat', text: 'Personas — custom AI system prompts per conversation' },
      { type: 'feat', text: 'Automation scheduler — cron-like background jobs' },
      { type: 'feat', text: 'Hosted services — start, stop, monitor long-running apps' },
      { type: 'feat', text: 'Snapshots — workspace backup and restore' },
      { type: 'feat', text: 'Full-text search — BM25 ranked search across all workspace files' },
      { type: 'feat', text: 'Action ledger — audit trail of all AI tool use' },
      { type: 'feat', text: 'Policy engine — block or confirm destructive operations' },
      { type: 'feat', text: 'Cloud registry — federation endpoints and hub registration' },
      { type: 'feat', text: 'Command palette — keyboard-driven navigation' },
      { type: 'feat', text: 'File upload/download support (up to 50MB)' },
      { type: 'feat', text: 'Plugin system — install and manage custom extensions' },
      { type: 'feat', text: 'Community panel — feature request board with voting' },
    ],
  },
  {
    version: '0.1.0',
    date: 'April 2026',
    label: null,
    changes: [
      { type: 'feat', text: 'Initial build — FastAPI backend + React frontend' },
      { type: 'feat', text: 'AI chat with SSE streaming and agentic tool loop' },
      { type: 'feat', text: 'Bash, read_file, write_file, list_files tools — all local' },
      { type: 'feat', text: 'File explorer with tree view and content preview' },
      { type: 'feat', text: 'Single Docker container — Railway-ready' },
      { type: 'feat', text: 'Nexus.computer dark terminal aesthetic' },
    ],
  },
]

const ROADMAP = [
  { status: 'next', text: 'Web browser integration — Nexus AI controls a browser on your behalf' },
  { status: 'next', text: 'Mobile-optimized layout — full experience on phone' },
  { status: 'planned', text: 'Federation — connect Nexus.computer nodes across the Nexus mesh' },
  { status: 'planned', text: 'Email/Telegram access — talk to your Nexus from anywhere' },
  { status: 'planned', text: 'NexusLang (nxl) integration — run .nxl scripts directly in Nexus.computer' },
  { status: 'planned', text: 'Community skill gallery — share and install skills from other users' },
  { status: 'planned', text: 'One-line install script — curl | sh for any Linux machine' },
  { status: 'idea', text: 'GPU inference layer — run local models without Nexus AI' },
  { status: 'idea', text: 'Collaborative workspaces — share a Nexus node with trusted users' },
]

const TYPE_STYLE = {
  feat: { color: 'var(--green)', bg: 'var(--green-dim)', label: 'feat' },
  fix:  { color: 'var(--amber)', bg: 'rgba(255,184,48,0.1)', label: 'fix' },
  break:{ color: 'var(--red)',   bg: 'rgba(255,77,106,0.1)', label: 'breaking' },
}

const STATUS_STYLE = {
  next:    { color: 'var(--accent)', label: 'Next up' },
  planned: { color: 'var(--amber)', label: 'Planned' },
  idea:    { color: 'var(--text-dim)', label: 'Idea' },
}

const S = {
  wrap: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' },
  header: {
    padding: '12px 16px', borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
  },
  title: { fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700 },
  tabs: { display: 'flex', gap: 4, padding: '8px 12px', borderBottom: '1px solid var(--border)' },
  tab: (a) => ({
    padding: '4px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
    color: a ? 'var(--accent)' : 'var(--text-dim)',
    background: a ? 'var(--accent-glow)' : 'transparent',
    border: a ? '1px solid rgba(0,217,255,0.2)' : '1px solid transparent',
    transition: 'all 0.15s',
  }),
  body: { padding: '12px', display: 'flex', flexDirection: 'column', gap: 16 },
  release: { display: 'flex', flexDirection: 'column', gap: 8 },
  relHeader: { display: 'flex', alignItems: 'center', gap: 8 },
  version: { fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text)' },
  latestBadge: {
    fontSize: 9, padding: '2px 7px', borderRadius: 8, fontWeight: 700,
    background: 'rgba(0,217,255,0.1)', color: 'var(--accent)',
    border: '1px solid rgba(0,217,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase',
  },
  date: { fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' },
  changeList: { display: 'flex', flexDirection: 'column', gap: 4 },
  change: { display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, lineHeight: 1.5 },
  typeBadge: (t) => ({
    fontSize: 9, padding: '1px 6px', borderRadius: 3, flexShrink: 0, marginTop: 2,
    color: (TYPE_STYLE[t] || TYPE_STYLE.feat).color,
    background: (TYPE_STYLE[t] || TYPE_STYLE.feat).bg,
    fontWeight: 700, letterSpacing: '0.06em',
  }),
  changeText: { color: 'var(--text-dim)' },
  divider: { height: 1, background: 'var(--border)' },
  roadItem: { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border-dim)' },
  statusDot: (s) => ({
    width: 7, height: 7, borderRadius: '50%', marginTop: 4, flexShrink: 0,
    background: (STATUS_STYLE[s] || STATUS_STYLE.idea).color,
  }),
  roadLabel: { fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'var(--text-muted)', marginBottom: 2 },
  roadText: { fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 },
  ghLink: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px',
    background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6,
    fontSize: 12, color: 'var(--text-dim)', cursor: 'pointer', textDecoration: 'none',
    transition: 'border-color 0.15s',
  },
}

export default function ChangelogPanel() {
  const [tab, setTab] = useState('changelog')

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <span style={S.title}>Updates</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>The No Hands Company</span>
      </div>

      <div style={S.tabs}>
        {[['changelog','Changelog'],['roadmap','Roadmap'],['links','Links']].map(([v,l]) => (
          <button key={v} style={S.tab(tab === v)} onClick={() => setTab(v)}>{l}</button>
        ))}
      </div>

      <div style={S.body}>
        {tab === 'changelog' && RELEASES.map((r, i) => (
          <div key={r.version}>
            {i > 0 && <div style={S.divider} />}
            <div style={S.release}>
              <div style={S.relHeader}>
                <span style={S.version}>v{r.version}</span>
                {r.label === 'latest' && <span style={S.latestBadge}>latest</span>}
                <span style={S.date}>{r.date}</span>
              </div>
              <div style={S.changeList}>
                {r.changes.map((c, j) => (
                  <div key={j} style={S.change}>
                    <span style={S.typeBadge(c.type)}>{TYPE_STYLE[c.type]?.label || c.type}</span>
                    <span style={S.changeText}>{c.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {tab === 'roadmap' && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.7 }}>
              Nexus.computer is free and open source. The roadmap is shaped by the community —
              vote on features in the Community tab.
            </div>
            {ROADMAP.map((item, i) => (
              <div key={i} style={S.roadItem}>
                <div style={S.statusDot(item.status)} />
                <div>
                  <div style={S.roadLabel}>{STATUS_STYLE[item.status]?.label}</div>
                  <div style={S.roadText}>{item.text}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'links' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'GitHub', sub: 'Source code, issues, PRs', url: 'https://github.com/The-No-Hands-company/nexus-computer' },
              { label: 'The No Hands Company', sub: 'All Nexus ecosystem projects', url: 'https://github.com/The-No-Hands-company' },
              { label: 'Report an issue', sub: 'Bug reports and feature requests', url: 'https://github.com/The-No-Hands-company/nexus-computer/issues' },
              { label: 'Nexus Ecosystem', sub: 'Full vision — self-hosted, federated', url: 'https://github.com/The-No-Hands-company/nexus-computer/blob/main/ECOSYSTEM.md' },
            ].map(({ label, sub, url }) => (
              <a key={label} href={url} target="_blank" rel="noreferrer" style={S.ghLink}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-dim)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>↗</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
