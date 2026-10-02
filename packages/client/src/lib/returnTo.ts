/**
 * Where to send someone back to after they sign in.
 *
 * Without this, a shared link to a spot loses its coordinates: the guard sends
 * an unauthenticated visitor to /login, and the login page would then drop them
 * at "/" with the query string gone.
 */

const KEY = 'returnTo';

export function rememberCurrentLocation(): void {
  try {
    sessionStorage.setItem(KEY, window.location.pathname + window.location.search);
  } catch {
    // Private window or blocked storage; the visitor lands on "/" instead.
  }
}

export function takeReturnLocation(): string {
  try {
    const saved = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    // Only a same-origin path, never an absolute URL, so a crafted value
    // cannot redirect someone off the site after login.
    if (saved && saved.startsWith('/') && !saved.startsWith('//')) return saved;
  } catch {
    // fall through
  }
  // The instrument, not the landing page: someone who just entered a key wants
  // the tool rather than the pitch for it.
  return '/app';
}
