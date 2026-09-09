import {
  Boxes,
  ClipboardList,
  LayoutDashboard,
  ScanLine,
  Settings,
  TrendingUp,
  UsersRound,
} from 'lucide-react'
import { DashboardShell, type DashboardNavItem } from '../components/navigation/DashboardShell'

const navigation: DashboardNavItem[] = [
  { label: 'Dashboard', to: '/owner', icon: LayoutDashboard, end: true },
  { label: 'Orders', to: '/owner/orders', icon: ClipboardList },
  { label: 'Inventory', to: '/owner/inventory', icon: Boxes },
  { label: 'Point of sale', to: '/owner/pos', icon: ScanLine },
  { label: 'People', to: '/owner/people', icon: UsersRound },
  { label: 'Reports', to: '/owner/reports', icon: TrendingUp },
  { label: 'Settings', to: '/owner/settings', icon: Settings },
]

export function OwnerLayout() {
  return <DashboardShell navigation={navigation} role="owner" />
}
