import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated' | 'unreachable';

// The dev server and vite start together, and vite wins — it has no database
// to connect to first. Without a retry the first check loses that race and the
// app is stuck on an error until a manual reload.
const RETRY_DELAYS_MS = [400, 800, 1600];

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>('loading');

  useEffect(() => {
    let cancelled = false;

    const attempt = async (n: number): Promise<void> => {
      try {
        const r = await apiFetch('/api/auth/me');
        if (cancelled) return;
        if (r.ok) return setState('authenticated');
        // Only a 401 is definitive; anything else is worth another try.
        if (r.status === 401) return setState('unauthenticated');
        throw new Error(`status ${r.status}`);
      } catch {
        if (cancelled) return;
        const delay = RETRY_DELAYS_MS[n];
        if (delay === undefined) return setState('unreachable');
        setTimeout(() => {
          if (!cancelled) void attempt(n + 1);
        }, delay);
      }
    };

    void attempt(0);
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
