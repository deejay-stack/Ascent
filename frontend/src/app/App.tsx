import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '../contexts/AuthContext'
import { ThemeProvider } from '../contexts/ThemeContext'
import { MotionProvider } from '../animations/MotionProvider'
import { appRouter } from './router'

export function App() {
  return (
    <MotionProvider>
      <ThemeProvider>
        <AuthProvider>
          <RouterProvider router={appRouter} />
        </AuthProvider>
      </ThemeProvider>
    </MotionProvider>
  )
}
