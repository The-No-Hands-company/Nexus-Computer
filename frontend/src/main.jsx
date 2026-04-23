import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '40px', fontFamily: 'JetBrains Mono, monospace',
          background: '#05080f', color: '#ff4d6a', height: '100vh',
          display: 'flex', flexDirection: 'column', gap: '16px',
        }}>
          <div style={{ fontSize: '13px', color: '#00d9ff', letterSpacing: '0.15em' }}>
            NEXUS — RENDER ERROR
          </div>
          <div style={{ fontSize: '12px', color: '#ff4d6a', fontWeight: 700 }}>
            {this.state.error.message}
          </div>
          <pre style={{
            fontSize: '11px', color: '#4a6078', whiteSpace: 'pre-wrap',
            wordBreak: 'break-all', maxHeight: '60vh', overflowY: 'auto',
            background: '#090d18', padding: '16px', borderRadius: '4px',
            border: '1px solid #1a2640',
          }}>
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 20px', background: '#00d9ff', color: '#05080f',
              border: 'none', borderRadius: '4px', cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 700, width: 'fit-content',
            }}
          >Reload</button>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
