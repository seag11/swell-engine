import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>('loading');

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then((r) => setState(r.ok ? 'authenticated' : 'unauthenticated'))
      .catch(() => setState('unauthenticated'));
  }, []);

  return state;
}
