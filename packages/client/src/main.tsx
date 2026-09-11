import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/index.css'
import App from '@/App'
import LoginPage from '@/pages/LoginPage'
import AuthGuard from '@/components/AuthGuard'

// Apply theme before first render to prevent flash
const saved = localStorage.getItem('theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
if (saved === 'dark' || (!saved && prefersDark)) {
  document.documentElement.classList.add('dark');
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

const isLoginPage = window.location.pathname === '/login';

createRoot(root, {
  onUncaughtError: (err) => console.error('[react] uncaught', err),
  onRecoverableError: (err) => console.error('[react] recoverable', err),
}).render(
  <StrictMode>
    {isLoginPage ? (
      <LoginPage />
    ) : (
      <AuthGuard>
        <App />
      </AuthGuard>
    )}
  </StrictMode>
)
