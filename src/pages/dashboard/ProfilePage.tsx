import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useAppTheme } from '../../hooks/useAppTheme'
export function ProfilePage() {
  const {user}=useAuth(),{theme,toggleTheme}=useAppTheme()
  return <section className="operations-page"><header className="operations-heading"><div><p className="eyebrow">Your account</p><h2>Profile</h2></div></header><section className="report-panel"><dl className="profile-details"><dt>Name</dt><dd>{user?.name}</dd><dt>Email</dt><dd>{user?.email}</dd><dt>Role</dt><dd>{user?.role}</dd></dl><button className="button button-secondary" onClick={toggleTheme}>Switch to {theme==='dark'?'light':'dark'} appearance</button><p className="muted">Account detail editing will become available with the account management service.</p><Link className="text-action" to="/products">Browse store</Link></section></section>
}
