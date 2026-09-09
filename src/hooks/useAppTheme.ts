import { useContext } from 'react'
import { ThemeContext } from '../contexts/themeContextValue'

export function useAppTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useAppTheme must be used within ThemeProvider')
  return context
}
