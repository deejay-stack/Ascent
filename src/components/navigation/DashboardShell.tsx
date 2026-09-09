import {
  ChevronRight,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BrandMark } from '../BrandMark'
import { ThemeToggle } from '../ThemeToggle'
import { useAuth } from '../../hooks/useAuth'
import { useAppTheme } from '../../hooks/useAppTheme'
import { roleLabels, type UserRole } from '../../types/roles'

export type DashboardNavItem = {
  label: string
  to: string
  icon: LucideIcon
  end?: boolean
}

type DashboardShellProps = {
  role: UserRole
  navigation: DashboardNavItem[]
  children?: ReactNode
}

export function DashboardShell({ role, navigation }: DashboardShellProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useAppTheme()
  const location = useLocation()
  const navigate = useNavigate()

  const activeItem = navigation.find((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to),
  )

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className={`dashboard-shell ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={`dashboard-sidebar ${isMobileOpen ? 'is-open' : ''}`}>
        <div className="sidebar-brand-row">
          <BrandMark compact={isCollapsed} />
          <button
            aria-label="Close navigation"
            className="icon-button lg:hidden"
            onClick={() => setIsMobileOpen(false)}
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        {!isCollapsed && <p className="workspace-label">{roleLabels[role]} workspace</p>}

        <nav className="dashboard-nav" aria-label={`${roleLabels[role]} navigation`}>
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                end={item.end}
                key={item.to}
                onClick={() => setIsMobileOpen(false)}
                title={isCollapsed ? item.label : undefined}
                to={item.to}
              >
                <Icon aria-hidden="true" size={19} />
                {!isCollapsed && <span>{item.label}</span>}
              </NavLink>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <button
            className="sidebar-action hidden lg:flex"
            onClick={() => setIsCollapsed((current) => !current)}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            type="button"
          >
            {isCollapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
            {!isCollapsed && <span>Collapse</span>}
          </button>
          <button className="sidebar-action" onClick={handleSignOut} type="button">
            <LogOut size={19} />
            {!isCollapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {isMobileOpen && (
        <button
          aria-label="Close navigation overlay"
          className="sidebar-overlay"
          onClick={() => setIsMobileOpen(false)}
          type="button"
        />
      )}

      <div className="dashboard-main">
        <header className="dashboard-header">
          <div className="flex min-w-0 items-center gap-3">
            <button
              aria-label="Open navigation"
              className="icon-button lg:hidden"
              onClick={() => setIsMobileOpen(true)}
              type="button"
            >
              <Menu size={20} />
            </button>
            <div className="min-w-0">
              <p className="breadcrumb">
                {roleLabels[role]} <ChevronRight size={13} />
              </p>
              <h1>{activeItem?.label ?? 'Workspace'}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle onToggle={toggleTheme} theme={theme} />
            <div className="user-chip">
              <span>{user?.name.charAt(0)}</span>
              <div className="hidden sm:block">
                <strong>{user?.name}</strong>
                <small>{roleLabels[role]}</small>
              </div>
            </div>
          </div>
        </header>

        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
