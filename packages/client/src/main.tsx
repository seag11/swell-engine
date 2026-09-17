import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/index.css'
import ConditionsPage from '@/pages/ConditionsPage'
import LoginPage from '@/pages/LoginPage'
import AuthGuard from '@/components/AuthGuard'
import { getInitialTheme } from '@/lib/useTheme'

// Apply theme before first render to prevent flash
document.documentElement.classList.toggle('dark', getInitialTheme() === 'dark');

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
        <ConditionsPage />
      </AuthGuard>
    )}
  </StrictMode>
)
