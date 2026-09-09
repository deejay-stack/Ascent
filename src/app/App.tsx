import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '../contexts/AuthContext'
import { CartProvider } from '../contexts/CartContext'
import { ThemeProvider } from '../contexts/ThemeContext'
import { MotionProvider } from '../animations/MotionProvider'
import { appRouter } from './router'

export function App() {
  return (
    <MotionProvider>
      <ThemeProvider>
        <AuthProvider>
          <CartProvider>
            <RouterProvider router={appRouter} />
          </CartProvider>
        </AuthProvider>
      </ThemeProvider>
    </MotionProvider>
  )
}
