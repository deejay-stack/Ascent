import { Moon, Sun } from 'lucide-react'
import type { Theme } from '../types/auth'

type ThemeToggleProps = {
  theme: Theme
  onToggle: () => void
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isDark = theme === 'dark'

  return (
    <button
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className="theme-toggle"
      onClick={onToggle}
      type="button"
    >
      {isDark ? <Moon size={17} /> : <Sun size={17} />}
      <span>{isDark ? 'Dark' : 'Light'}</span>
    </button>
  )
}
