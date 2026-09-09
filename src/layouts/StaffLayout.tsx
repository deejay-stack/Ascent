import { Boxes, CircleUserRound, ClipboardList, LayoutDashboard, ScanLine } from 'lucide-react'
import { DashboardShell, type DashboardNavItem } from '../components/navigation/DashboardShell'

const navigation: DashboardNavItem[] = [
  { label: 'Dashboard', to: '/staff', icon: LayoutDashboard, end: true },
  { label: 'Orders', to: '/staff/orders', icon: ClipboardList },
  { label: 'Inventory', to: '/staff/inventory', icon: Boxes },
  { label: 'Point of sale', to: '/staff/pos', icon: ScanLine },
  { label: 'My profile', to: '/staff/profile', icon: CircleUserRound },
]

export function StaffLayout() {
  return <DashboardShell navigation={navigation} role="staff" />
}
