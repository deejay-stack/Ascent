import { mockStorage } from '../services/storage/mockStorage'
import { useEffect, useMemo, useState } from 'react'
import type { Theme } from '../types/auth'

const storageKey = 'ascent-theme'

const getInitialTheme = (): Theme => {
  const savedTheme = mockStorage.getText(storageKey)

  if (savedTheme === 'light' || savedTheme === 'dark') {
    return savedTheme
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    const root = document.documentElement

    root.classList.toggle('dark', theme === 'dark')
    root.dataset.theme = theme
    root.style.colorScheme = theme
    try {
      mockStorage.setText(storageKey, theme)
    } catch {
      /* A full preference store must not prevent sign-in. */
    }
  }, [theme])

  return useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      setTheme,
      toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
    }),
    [theme],
  )
}
