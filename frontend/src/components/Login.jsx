import { useState, useEffect } from 'react'

const S = {
  wrap: {
    height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg)',
    backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(0,217,255,0.06) 0%, transparent 65%)',
  },
  card: {
    width: '340px', padding: '48px 36px',
    background: 'var(--bg-2)', border: '1px solid var(--border)',
    borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '20px',
    boxShadow: '0 0 60px rgba(0,217,255,0.05)',
  },
  brand: { textAlign: 'center' },
  logo: {
    fontFamily: 'var(--font-brand)', fontSize: '20px', fontWeight: 900,
    color: 'var(--accent)', letterSpacing: '0.22em',
    textShadow: '0 0 30px rgba(0,217,255,0.5)',
  },
  tld: { fontFamily: 'var(--font-brand)', fontSize: '12px', color: 'var(--text-dim)', letterSpacing: '0.12em' },
  heading: { fontSize: '12px', color: 'var(--text-dim)', letterSpacing: '0.1em', textAlign: 'center', marginTop: '-4px' },
  label: { fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' },
  input: {
    width: '100%', padding: '10px 14px', background: 'var(--bg-3)',
    border: '1px solid var(--border)', borderRadius: 'var(--r)',
    color: 'var(--text)', fontSize: '13px', transition: 'border-color 0.2s',
  },
  btn: (loading) => ({
    width: '100%', padding: '11px', borderRadius: 'var(--r)',
    background: loading ? 'var(--accent-dim)' : 'var(--accent)',
    color: 'var(--bg)', fontWeight: 700, fontSize: '11px',
    letterSpacing: '0.15em', textTransform: 'uppercase',
    cursor: loading ? 'not-allowed' : 'pointer',
    fontFamily: 'var(--font-brand)', transition: 'background 0.2s',
  }),
  err: {
    fontSize: '12px', color: 'var(--red)', padding: '8px 12px',
    background: 'rgba(255,77,106,0.08)', borderRadius: 'var(--r)',
  },
  note: { fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 },
}

export default function Login({ onDone, isSetup }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const focus = e => e.target.style.borderColor = 'var(--accent-dim)'
  const blur = e => e.target.style.borderColor = 'var(--border)'

  const submit = async () => {
    setErr('')
    if (isSetup) {
      if (password.length < 6) { setErr('Password must be at least 6 characters'); return }
      if (password !== confirm) { setErr('Passwords do not match'); return }
    } else {
      if (!password) { setErr('Enter your password'); return }
    }
    setLoading(true)
    try {
      const endpoint = isSetup ? '/api/auth/setup' : '/api/auth/login'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed')
      onDone(data.token)
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  const onKey = e => { if (e.key === 'Enter') submit() }

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <div style={S.brand}>
          <div style={S.logo}>NEXUS<span style={S.tld}>.computer</span></div>
        </div>

        <div style={S.heading}>
          {isSetup ? 'Set up your local password' : 'Enter your password'}
        </div>

        <div>
          <label style={S.label}>Password</label>
          <input style={S.input} type="password" value={password}
            onChange={e => setPassword(e.target.value)} onKeyDown={onKey}
            onFocus={focus} onBlur={blur} autoFocus placeholder="••••••••" />
        </div>

        {isSetup && (
          <div>
            <label style={S.label}>Confirm password</label>
            <input style={S.input} type="password" value={confirm}
              onChange={e => setConfirm(e.target.value)} onKeyDown={onKey}
              onFocus={focus} onBlur={blur} placeholder="••••••••" />
          </div>
        )}

        {err && <div style={S.err}>{err}</div>}

        <button style={S.btn(loading)} onClick={submit} disabled={loading}>
          {loading ? '...' : isSetup ? 'Set Password' : 'Login'}
        </button>

        <div style={S.note}>
          {isSetup
            ? 'Your password is stored locally on this machine. No accounts, no cloud.'
            : 'Self-hosted · Private · Yours'}
        </div>
      </div>
    </div>
  )
}
