import { useState, useEffect } from 'react'

/* ── Icons ── */
const Icon = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
)

const icons = {
  home:       ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'],
  files:      ['M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z', 'M13 2v7h7'],
  chats:      'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  automations:'M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83',
  workspace:  ['M2 20h20', 'M4 4h16v12H4z'],
  personas:   'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  computer:   ['M2 3h20v14H2z', 'M8 21h8M12 17v4'],
  terminal:   ['M4 17l6-6-6-6', 'M12 19h8'],
  services:   ['M12 2L2 7l10 5 10-5-10-5z', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'],
  actions:    ['M9 11l3 3L22 4', 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'],
  snapshots:  ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 6v6l4 2'],
  network:    ['M5 12.55a11 11 0 0 1 14.08 0', 'M1.42 9a16 16 0 0 1 21.16 0', 'M8.53 16.11a6 6 0 0 1 6.95 0', 'M12 20h.01'],
  community:  ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  docs:       ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'],
  more:       'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  chevron:    'M9 18l6-6-6-6',
  plugins:    ['M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'],
  account:    ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  github:     'M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22',
}

function SvgIcon({ name, size = 18 }) {
  const d = icons[name] || icons.more
  return <Icon d={d} size={size} />
}

/* ── Styles ── */
const NAV_W = 220
const ICON_W = 48

const S = {
  nav: {
    width: `${NAV_W}px`,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-2)',
    borderRight: '1px solid var(--border)',
    flexShrink: 0,
    userSelect: 'none',
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  section: {
    padding: '8px 0 4px',
  },
  sectionLabel: {
    padding: '0 14px 4px',
    fontSize: '9px',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    fontWeight: 700,
  },
  item: (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '7px 14px',
    borderRadius: '6px',
    margin: '1px 6px',
    cursor: 'pointer',
    color: active ? 'var(--accent)' : 'var(--text-dim)',
    background: active ? 'var(--accent-glow)' : 'transparent',
    border: active ? '1px solid rgba(0,217,255,0.15)' : '1px solid transparent',
    transition: 'all 0.12s',
    fontSize: '13px',
    fontWeight: active ? 600 : 400,
    position: 'relative',
  }),
  itemLabel: {
    flex: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  badge: (color = 'var(--accent)') => ({
    fontSize: '9px', fontWeight: 700,
    padding: '1px 5px', borderRadius: '8px',
    background: `${color}22`, color, border: `1px solid ${color}44`,
    flexShrink: 0,
  }),
  chevron: (open) => ({
    transition: 'transform 0.15s',
    transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
    flexShrink: 0,
    opacity: 0.5,
  }),
  sub: (open) => ({
    overflow: 'hidden',
    maxHeight: open ? '400px' : '0',
    transition: 'max-height 0.2s ease',
  }),
  subItem: (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '6px 14px 6px 38px',
    margin: '1px 6px',
    borderRadius: '6px',
    cursor: 'pointer',
    color: active ? 'var(--accent)' : 'var(--text-dim)',
    background: active ? 'var(--accent-glow)' : 'transparent',
    border: active ? '1px solid rgba(0,217,255,0.15)' : '1px solid transparent',
    transition: 'all 0.12s',
    fontSize: '12px',
  }),
  divider: {
    height: '1px',
    background: 'var(--border)',
    margin: '6px 14px',
  },
  footer: {
    marginTop: 'auto',
    borderTop: '1px solid var(--border)',
    padding: '8px 0',
  },
  nexusAiStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    fontSize: '11px',
    color: 'var(--text-dim)',
  },
  dot: (ok) => ({
    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
    background: ok ? 'var(--green)' : 'var(--red)',
    boxShadow: ok ? '0 0 6px var(--green)' : 'none',
    animation: ok ? 'pulse 2s infinite' : 'none',
  }),
}

/* ── Nav item component ── */
function NavItem({ icon, label, active, badge, badgeColor, onClick, children, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen || false)
  const hasChildren = !!children

  const handleClick = () => {
    if (hasChildren) setOpen(o => !o)
    else onClick?.()
  }

  const hover = (e, on) => {
    if (active) return
    e.currentTarget.style.background = on ? 'rgba(255,255,255,0.04)' : 'transparent'
    e.currentTarget.style.color = on ? 'var(--text)' : 'var(--text-dim)'
  }

  return (
    <>
      <div
        style={S.item(active)}
        onClick={handleClick}
        onMouseEnter={e => hover(e, true)}
        onMouseLeave={e => hover(e, false)}
      >
        <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <SvgIcon name={icon} size={16} />
        </span>
        <span style={S.itemLabel}>{label}</span>
        {badge && <span style={S.badge(badgeColor)}>{badge}</span>}
        {hasChildren && (
          <span style={S.chevron(open)}>
            <SvgIcon name="chevron" size={13} />
          </span>
        )}
      </div>
      {hasChildren && (
        <div style={S.sub(open)}>
          {children}
        </div>
      )}
    </>
  )
}

function SubItem({ icon, label, active, badge, badgeColor, onClick }) {
  const hover = (e, on) => {
    if (active) return
    e.currentTarget.style.background = on ? 'rgba(255,255,255,0.04)' : 'transparent'
    e.currentTarget.style.color = on ? 'var(--text)' : 'var(--text-dim)'
  }
  return (
    <div
      style={S.subItem(active)}
      onClick={onClick}
      onMouseEnter={e => hover(e, true)}
      onMouseLeave={e => hover(e, false)}
    >
      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', opacity: 0.7 }}>
        <SvgIcon name={icon} size={14} />
      </span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge && <span style={S.badge(badgeColor)}>{badge}</span>}
    </div>
  )
}

/* ── Main Sidebar ── */
export default function Sidebar({ active, onNavigate, unhealthyCount = 0 }) {
  const [nexusAiOnline, setNexusAiOnline] = useState(null)

  useEffect(() => {
    const check = () =>
      fetch('/api/models')
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          const m = d?.models?.find(m => m.id === 'nexus-ai')
          setNexusAiOnline(m?.available ?? false)
        })
        .catch(() => setNexusAiOnline(false))
    check()
    const t = setInterval(check, 15000)
    return () => clearInterval(t)
  }, [])

  const nav = (view) => onNavigate(view)

  return (
    <nav style={S.nav}>
      {/* Primary */}
      <div style={S.section}>
        <NavItem icon="home"    label="Home"        active={active === 'home'}        onClick={() => nav('home')} />
        <NavItem icon="files"   label="Files"       active={active === 'files'}       onClick={() => nav('files')} />
        <NavItem icon="chats"   label="Chats"       active={active === 'chats'}       onClick={() => nav('chats')} />
        <NavItem icon="automations" label="Automations" active={active === 'automations'} onClick={() => nav('automations')} />
        <NavItem icon="workspace"   label="Workspace"   active={active === 'workspace'}   onClick={() => nav('workspace')} />
        <NavItem icon="personas"    label="Personas"    active={active === 'personas'}    onClick={() => nav('personas')} />
      </div>

      <div style={S.divider} />

      {/* Computer group */}
      <div style={S.section}>
        <div style={S.sectionLabel}>Computer</div>
        <NavItem
          icon="computer" label="Computer" defaultOpen
          active={['terminal','services','actions'].includes(active)}
        >
          <SubItem icon="terminal"  label="Terminal"  active={active === 'terminal'}  onClick={() => nav('terminal')} />
          <SubItem icon="services"  label="Services"  active={active === 'services'}
            badge={unhealthyCount > 0 ? `${unhealthyCount}` : undefined}
            badgeColor="var(--red)"
            onClick={() => nav('services')} />
          <SubItem icon="actions"   label="Actions"   active={active === 'actions'}   onClick={() => nav('actions')} />
          <SubItem icon="snapshots" label="Snapshots" active={active === 'snapshots'} onClick={() => nav('snapshots')} />
        </NavItem>
      </div>

      <div style={S.divider} />

      {/* More group */}
      <div style={S.section}>
        <NavItem icon="more" label="More">
          <SubItem icon="plugins"   label="Plugins"       active={active === 'plugins'}    onClick={() => nav('plugins')} />
          <SubItem icon="account"   label="Account"       active={active === 'account'}    onClick={() => nav('account')} />
          <SubItem icon="network"   label="Federation"    active={active === 'network'}    onClick={() => nav('network')} />
          <SubItem icon="community" label="Community"     active={active === 'community'}  onClick={() => nav('community')} />
          <SubItem icon="docs"      label="Documentation" onClick={() => window.open('https://github.com/The-No-Hands-company/nexus-computer', '_blank')} />
          <SubItem icon="github"    label="GitHub"        onClick={() => window.open('https://github.com/The-No-Hands-company', '_blank')} />
        </NavItem>
      </div>

      {/* Footer — Nexus AI status */}
      <div style={S.footer}>
        <div style={S.nexusAiStatus}>
          <div style={S.dot(nexusAiOnline === true)} />
          <span>
            Nexus AI&nbsp;
            {nexusAiOnline === null ? '—' : nexusAiOnline ? 'online' : 'offline'}
          </span>
        </div>
      </div>
    </nav>
  )
}
