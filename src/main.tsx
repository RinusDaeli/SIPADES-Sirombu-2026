import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

try {
  const rootEl = document.getElementById('root');
  if (rootEl) {
    // Explicitly remove the initial loader so it never stays stuck
    const loader = document.getElementById('app-loader');
    if (loader) {
      loader.remove();
    }

    createRoot(rootEl).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
  }
} catch (err: any) {
  console.error('[SIPADES Boot Error]:', err);
  const rootEl = document.getElementById('root');
  if (rootEl) {
    rootEl.innerHTML = `
      <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#070B14;color:#f1f5f9;font-family:sans-serif;padding:24px;text-align:center;">
        <h2 style="color:#ef4444;font-size:1.25rem;margin-bottom:8px;font-weight:bold;">Kendala Memuat Tampilan</h2>
        <p style="color:#94a3b8;font-size:0.875rem;max-width:420px;margin-bottom:16px;">
          ${err?.message || 'Gagal memproses memori tampilan.'}
        </p>
        <button onclick="localStorage.clear();sessionStorage.clear();window.location.reload();" style="padding:10px 20px;background:#10b981;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">
          Bersihkan Cache & Masuk
        </button>
      </div>
    `;
  }
}
