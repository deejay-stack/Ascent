import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="error-page">
      <p className="eyebrow">404 · Page not found</p>
      <h1>That route does not exist.</h1>
      <p>The page may have moved, or the address may be incomplete.</p>
      <Link className="primary-link" to="/">
        <ArrowLeft size={18} /> Return home
      </Link>
    </main>
  )
}
