import { createContext } from 'react'
import type { useTheme } from '../hooks/useTheme'

export type ThemeContextValue = ReturnType<typeof useTheme>

export const ThemeContext = createContext<ThemeContextValue | null>(null)
