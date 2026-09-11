import { useState, type FormEvent } from 'react';
import { useTheme } from '@/lib/useTheme';
import { apiFetch } from '@/lib/api';

export default function LoginPage() {
  const { theme, toggle } = useTheme();
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? 'Invalid token');
        return;
      }
      window.location.replace('/');
    } catch {
      setError('Could not reach server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sw-bg to-sw-card dark:from-sw-dark-bg dark:to-sw-dark-card text-sw-strong dark:text-sw-dark-strong flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold">Swell Engine</h1>
            <p className="text-sw-muted dark:text-sw-dark-muted text-sm mt-1">Beta access</p>
          </div>
          <button
            onClick={toggle}
            className="text-sw-muted dark:text-sw-dark-muted hover:text-sw-strong dark:hover:text-sw-dark-strong transition-colors text-lg"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sw-muted dark:text-sw-dark-muted text-xs uppercase tracking-wide mb-2">
              Beta key
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter your beta key"
              autoFocus
              className="w-full bg-sw-bg dark:bg-sw-dark-bg text-sw-strong dark:text-sw-dark-strong placeholder:text-sw-muted dark:placeholder:text-sw-dark-muted border border-sw-border dark:border-sw-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-sw-blue transition-colors"
            />
          </div>

          {error && (
            <div className="bg-sw-red/10 border border-sw-red rounded-lg p-3 text-sw-red text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !token}
            className="w-full bg-sw-blue hover:bg-[#2580B8] text-white disabled:opacity-40 rounded-lg px-4 py-2 font-medium transition-colors"
          >
            {loading ? 'Verifying…' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}
