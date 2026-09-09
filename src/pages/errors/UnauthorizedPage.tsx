import { ArrowLeft, ShieldX } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { roleHomePaths } from '../../types/roles'

export function UnauthorizedPage() {
  const { user } = useAuth()
  const destination = user ? roleHomePaths[user.role] : '/login'

  return (
    <main className="error-page">
      <ShieldX size={42} />
      <p className="eyebrow">403 · Access denied</p>
      <h1>This workspace is not available to your role.</h1>
      <p>ASCENT protects both navigation and route access. Return to your assigned workspace.</p>
      <Link className="primary-link" to={destination}>
        <ArrowLeft size={18} /> Go to my workspace
      </Link>
    </main>
  )
}
