import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/index.css'
import App from '@/App'

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root, {
  onUncaughtError: (err) => console.error('[react] uncaught', err),
  onRecoverableError: (err) => console.error('[react] recoverable', err),
}).render(
  <StrictMode>
    <App />
  </StrictMode>
)
