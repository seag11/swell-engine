import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/index.css'
import ConditionsPage from '@/pages/ConditionsPage'
import HeroPage from '@/pages/HeroPage'
import LoginPage from '@/pages/LoginPage'
import AuthGuard from '@/components/AuthGuard'
import { getInitialTheme } from '@/lib/useTheme'

// Apply theme before first render to prevent flash
document.documentElement.classList.toggle('dark', getInitialTheme() === 'dark');

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

// A lookup table rather than nested ternaries, so adding a route is one entry.
// Anything unmatched falls through to the public page, which is the right
// landing spot for a stale link.
const routes: Record<string, ReactNode> = {
  '/': <HeroPage />,
  '/login': <LoginPage />,
  '/app': (
    <AuthGuard>
      <ConditionsPage />
    </AuthGuard>
  ),
};

// Trailing slashes are stripped so /app/ and /app are the same route.
const path = window.location.pathname.replace(/\/+$/, '') || '/';
const page = routes[path] ?? <HeroPage />;

createRoot(root, {
  onUncaughtError: (err) => console.error('[react] uncaught', err),
  onRecoverableError: (err) => console.error('[react] recoverable', err),
}).render(<StrictMode>{page}</StrictMode>)
