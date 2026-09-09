import { useState, type FormEvent } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useAppTheme } from '../../hooks/useAppTheme'
import { peopleService } from '../../services/peopleService'
export function ProfilePage() {
  const { user, refreshUser } = useAuth(),
    { theme, toggleTheme } = useAppTheme()
  const [name, setName] = useState(user?.name ?? ''),
    [email, setEmail] = useState(user?.email ?? ''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      await peopleService.updateProfile(name, email)
      await refreshUser()
      setMessage('Profile saved. Email changes may require confirmation.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Profile could not be saved.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="operations-page">
      <header className="operations-heading">
        <div>
          <p className="eyebrow">Your account</p>
          <h2>Profile</h2>
        </div>
      </header>
      <form className="operation-form report-panel" onSubmit={submit}>
        <label className="field">
          Name
          <input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          Email
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <p>Role: {user?.role}</p>
        <button className="button button-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save profile'}
        </button>
        <p role="status">{message}</p>
        <button type="button" className="button button-secondary" onClick={toggleTheme}>
          Switch to {theme === 'dark' ? 'light' : 'dark'} appearance
        </button>
      </form>
    </section>
  )
}
