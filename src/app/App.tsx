import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '../contexts/AuthContext'
import { CartProvider } from '../contexts/CartContext'
import { ThemeProvider } from '../contexts/ThemeContext'
import { MotionProvider } from '../animations/MotionProvider'
import { appRouter } from './router'
import { CommerceSync } from '../components/CommerceSync'

export function App() {
  return (
    <MotionProvider>
      <ThemeProvider>
        <AuthProvider>
          <CommerceSync><CartProvider>
            <RouterProvider router={appRouter} />
          </CartProvider></CommerceSync>
        </AuthProvider>
      </ThemeProvider>
    </MotionProvider>
  )
}
