import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/lib/useAuth';

export default function AuthGuard({ children }: { children: ReactNode }) {
  const auth = useAuth();

  useEffect(() => {
    if (auth === 'unauthenticated') {
      window.location.replace('/login');
    }
  }, [auth]);

  if (auth === 'unreachable') {
    return (
      <div className="min-h-screen bg-sw-bg dark:bg-sw-dark-bg text-sw-strong dark:text-sw-dark-strong flex items-center justify-center p-8">
        <div className="max-w-sm text-center">
          <p className="font-semibold mb-1">Can&rsquo;t reach the server</p>
          <p className="text-sw-muted dark:text-sw-dark-muted text-sm">
            Check that it is running, then reload.
          </p>
        </div>
      </div>
    );
  }
  if (auth !== 'authenticated') return null;

  return <>{children}</>;
}
