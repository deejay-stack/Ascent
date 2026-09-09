import { PeoplePage } from '../pages/dashboard/PeoplePage'
import { AboutPage } from '../pages/public/AboutPage'
import { AuthCallbackPage } from '../pages/public/AuthCallbackPage'
import { ResetPasswordPage } from '../pages/public/ResetPasswordPage'
import { PosPage } from '../pages/dashboard/PosPage'
import { InventoryPage } from '../pages/dashboard/InventoryPage'
import { ReportsPage } from '../pages/dashboard/ReportsPage'
import { OrdersPage } from '../pages/dashboard/OrdersPage'
import { SettingsPage } from '../pages/dashboard/SettingsPage'
import { ProfilePage } from '../pages/dashboard/ProfilePage'
import { createBrowserRouter } from 'react-router-dom'
import { GuestRoute } from '../components/auth/GuestRoute'
import { ProtectedRoute } from '../components/auth/ProtectedRoute'
import { AuthPage } from '../features/auth/AuthPage'
import { CustomerLayout } from '../layouts/CustomerLayout'
import { OwnerLayout } from '../layouts/OwnerLayout'
import { PublicLayout } from '../layouts/PublicLayout'
import { StaffLayout } from '../layouts/StaffLayout'
import { RoleDashboardPage } from '../pages/dashboard/RoleDashboardPage'
import { CustomerOrdersPage } from '../pages/dashboard/CustomerOrdersPage'
import { NotFoundPage } from '../pages/errors/NotFoundPage'
import { UnauthorizedPage } from '../pages/errors/UnauthorizedPage'
import { HomePage } from '../pages/public/HomePage'
import { ProductCatalogPage } from '../pages/public/ProductCatalogPage'
import { ProductDetailsPage } from '../pages/public/ProductDetailsPage'
import { CartPage } from '../pages/public/CartPage'

export const appRouter = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'auth/callback', element: <AuthCallbackPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      {
        path: 'products',
        element: <ProductCatalogPage />,
      },
      {
        path: 'products/:productId',
        element: <ProductDetailsPage />,
      },
      {
        path: 'about',
        element: <AboutPage />,
      },
      {
        path: 'cart',
        element: <CartPage />,
      },
      {
        element: <GuestRoute />,
        children: [
          { path: 'login', element: <AuthPage key="login" /> },
          { path: 'register', element: <AuthPage initialMode="create" key="register" /> },
          { path: 'forgot-password', element: <AuthPage initialMode="recover" key="recover" /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={['customer']} />,
    children: [
      {
        path: 'account',
        element: <CustomerLayout />,
        children: [
          { index: true, element: <RoleDashboardPage role="customer" /> },
          { path: 'orders', element: <CustomerOrdersPage /> },
          { path: 'profile', element: <ProfilePage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={['staff']} />,
    children: [
      {
        path: 'staff',
        element: <StaffLayout />,
        children: [
          { index: true, element: <RoleDashboardPage role="staff" /> },
          { path: 'orders', element: <OrdersPage /> },
          { path: 'inventory', element: <InventoryPage /> },
          { path: 'pos', element: <PosPage /> },
          { path: 'profile', element: <ProfilePage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={['owner']} />,
    children: [
      {
        path: 'owner',
        element: <OwnerLayout />,
        children: [
          { index: true, element: <RoleDashboardPage role="owner" /> },
          { path: 'orders', element: <OrdersPage /> },
          { path: 'inventory', element: <InventoryPage /> },
          { path: 'pos', element: <PosPage /> },
          { path: 'people', element: <PeoplePage /> },
          { path: 'reports', element: <ReportsPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'profile', element: <ProfilePage /> },
        ],
      },
    ],
  },
  { path: '/unauthorized', element: <UnauthorizedPage /> },
  { path: '*', element: <NotFoundPage /> },
])
