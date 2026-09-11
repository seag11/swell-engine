import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/lib/useAuth';

export default function AuthGuard({ children }: { children: ReactNode }) {
  const auth = useAuth();

  useEffect(() => {
    if (auth === 'unauthenticated') {
      window.location.replace('/login');
    }
  }, [auth]);

  if (auth === 'loading') return null;
  if (auth === 'unauthenticated') return null;

  return <>{children}</>;
}
