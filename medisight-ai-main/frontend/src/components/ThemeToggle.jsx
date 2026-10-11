import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../lib/theme.jsx'

/** Small light/dark switch. `variant="dark"` is for use on an always-dark
 * surface (sidebar, auth panel) where the button itself needs light-on-dark
 * styling regardless of the active theme. */
export default function ThemeToggle({ variant = 'default', className = '' }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  const base = 'inline-flex items-center justify-center rounded-full p-2 transition-colors'
  const styles =
    variant === 'dark'
      ? 'text-ink-300 hover:bg-white/10 hover:text-white'
      : 'border border-wine-100 bg-white text-ink-700 shadow-soft hover:bg-blush-50 dark:border-ink-700 dark:bg-ink-800 dark:text-blush-100 dark:hover:bg-ink-700'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`${base} ${styles} ${className}`}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
    </button>
  )
}
