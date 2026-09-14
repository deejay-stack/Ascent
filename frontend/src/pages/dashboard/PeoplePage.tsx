import { useEffect, useState, type FormEvent } from 'react'
import { peopleService, type Person } from '../../services/peopleService'
import { Modal } from '../../components/ui/Modal'
import { useAuth } from '../../hooks/useAuth'
export function PeoplePage() {
  const { user } = useAuth()
  const [people, setPeople] = useState<Person[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(''),
    [role, setRole] = useState(''),
    [creating, setCreating] = useState(false),
    [busy, setBusy] = useState(false)
  const [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState('')
  useEffect(() => {
    let active = true
    peopleService
      .list()
      .then((p) => {
        if (active) setPeople(p)
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])
  const reload = async () => setPeople(await peopleService.list())
  const create = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await peopleService.createStaff(name, email, password)
      await reload()
      setCreating(false)
      setName('')
      setEmail('')
      setPassword('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create staff.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="operations-page">
      <header className="operations-heading">
        <div>
          <p className="eyebrow">Team & customers</p>
          <h2>People</h2>
          <p>Manage registered users and approve staff or admin access requests.</p>
        </div>
        <button className="button button-primary" onClick={() => setCreating(true)}>
          Create staff account
        </button>
      </header>
      <div className="table-filters">
        <label className="field">
          Search people
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or email"
          />
        </label>
        <label className="field">
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            <option value="staff">Staff</option>
            <option value="customer">Customer</option>
            <option value="owner">Owner</option>
          </select>
        </label>
      </div>
      {error && !creating && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {loading ? (
        <p>Loading people…</p>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {people
                .filter(
                  (p) =>
                    (!role || p.role === role) &&
                    [p.name, p.email].join(' ').toLowerCase().includes(search.toLowerCase()),
                )
                .map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.email}</td>
                    <td>
                      {p.role}
                      {p.requestedRole && (
                        <p>
                          Requests {p.requestedRole === 'owner' ? 'admin / owner' : 'staff'} access
                        </p>
                      )}
                    </td>
                    <td>{p.isActive ? 'Active' : 'Disabled'}</td>
                    <td>
                      {p.requestedRole && (
                        <div className="action-row">
                          <button
                            className="text-action"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true)
                              try {
                                await peopleService.reviewAccess(p.id, true)
                                await reload()
                              } catch (e) {
                                setError(e instanceof Error ? e.message : 'Approval failed.')
                              } finally {
                                setBusy(false)
                              }
                            }}
                          >
                            Approve {p.requestedRole === 'owner' ? 'admin' : 'staff'}
                          </button>
                          <button
                            className="text-action"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true)
                              try {
                                await peopleService.reviewAccess(p.id, false)
                                await reload()
                              } catch (e) {
                                setError(
                                  e instanceof Error ? e.message : 'Could not decline request.',
                                )
                              } finally {
                                setBusy(false)
                              }
                            }}
                          >
                            Decline request
                          </button>
                        </div>
                      )}
                      {p.id !== user?.id && (
                        <button
                          className="text-action"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true)
                            setError('')
                            try {
                              await peopleService.setActive(p.id, !p.isActive)
                              await reload()
                            } catch (e) {
                              setError(e instanceof Error ? e.message : 'Could not change access.')
                            } finally {
                              setBusy(false)
                            }
                          }}
                        >
                          {p.isActive ? 'Disable access' : 'Enable access'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && (
        <Modal title="Create staff account" onClose={() => setCreating(false)}>
          <form className="operation-form" onSubmit={create}>
            <label className="field">
              Full name
              <input
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="field">
              Email
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field">
              Initial password
              <input
                required
                type="password"
                minLength={12}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <p className="muted">
              Use a unique password of at least 12 characters and share it securely with the staff
              member.
            </p>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button className="button button-primary" disabled={busy}>
              {busy ? 'Creating…' : 'Create staff'}
            </button>
          </form>
        </Modal>
      )}
    </section>
  )
}
