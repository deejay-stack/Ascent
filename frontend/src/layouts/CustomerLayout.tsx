import { CircleUserRound, LayoutDashboard, PackageCheck, ShoppingBasket } from 'lucide-react'
import { DashboardShell, type DashboardNavItem } from '../components/navigation/DashboardShell'

const navigation: DashboardNavItem[] = [
  { label: 'Overview', to: '/account', icon: LayoutDashboard, end: true },
  { label: 'My orders', to: '/account/orders', icon: PackageCheck },
  { label: 'Cart', to: '/cart', icon: ShoppingBasket },
  { label: 'Profile', to: '/account/profile', icon: CircleUserRound },
]

export function CustomerLayout() {
  return <DashboardShell navigation={navigation} role="customer" />
}
