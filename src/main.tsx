import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import '@xterm/xterm/css/xterm.css';

window.addEventListener('error', (e) => {
  console.error('[cc-chamber] window error:', e.error || e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[cc-chamber] unhandled rejection:', e.reason);
});

// NOTE: StrictMode is intentionally disabled. Our app holds long-lived
// PTY processes per session and StrictMode's mount→cleanup→mount cycle
// kills the first PTY, then either races with the second spawn or leaves
// stale exit handlers that report "exited" while the real PTY runs fine.
// In production React never double-mounts, so this only affects dev.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
