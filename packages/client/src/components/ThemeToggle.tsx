import { useTheme } from '@/lib/useTheme';

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      className="text-sw-muted dark:text-sw-dark-muted hover:text-sw-strong dark:hover:text-sw-dark-strong transition-colors text-lg"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  );
}
