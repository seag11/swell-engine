import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated' | 'unreachable';

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>('loading');

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then((r) => {
        if (r.ok) return setState('authenticated');
        // Only a 401 means "log in"; anything else is the server having a problem.
        setState(r.status === 401 ? 'unauthenticated' : 'unreachable');
      })
      .catch(() => setState('unreachable'));
  }, []);

  return state;
}
