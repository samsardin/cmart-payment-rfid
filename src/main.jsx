import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught app error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          fontFamily: 'Outfit, sans-serif',
          background: '#f8fafc',
          color: '#1e293b',
          textAlign: 'center'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
            maxWidth: '500px',
            border: '1px solid #e2e8f0'
          }}>
            <h2 style={{ color: '#e11d48', marginTop: 0 }}>⚠️ Memuat Ulang Sistem</h2>
            <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
              Terjadi sedikit kendala memori lokal. Silakan klik tombol di bawah untuk memuat ulang.
            </p>
            <pre style={{
              background: '#f1f5f9',
              padding: '0.75rem',
              borderRadius: '8px',
              fontSize: '0.75rem',
              overflowX: 'auto',
              textAlign: 'left'
            }}>
              {this.state.error?.toString()}
            </pre>
            <button 
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }} 
              style={{
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '10px',
                fontWeight: 700,
                cursor: 'pointer',
                marginTop: '1rem'
              }}
            >
              🔄 Reset Cache & Muat Ulang
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
