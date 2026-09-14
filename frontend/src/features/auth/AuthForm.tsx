import { isSupabaseMode } from '../../services/supabaseClient'
import { Eye, EyeOff } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { demoCredentials } from '../../data/authContent'
import type { AuthMode } from '../../types/auth'
import type { UserRole } from '../../types/roles'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../hooks/useAuth'

type AuthFormProps = {
  selectedRole: UserRole
  onRoleChange: (role: UserRole) => void
  initialMode?: AuthMode
}

const modeCopy: Record<AuthMode, { title: string; copy: string; action: string }> = {
  signin: {
    title: 'Welcome back',
    copy: 'Sign in to continue running your store from one connected workspace.',
    action: 'Sign in',
  },
  create: {
    title: 'Create your account',
    copy: 'Use your own email and password to join ASCENT.',
    action: 'Create account',
  },
  recover: {
    title: 'Reset access',
    copy: 'Enter your email and Ascent will send a secure reset link.',
    action: 'Send reset link',
  },
}

export function AuthForm({ selectedRole, onRoleChange, initialMode = 'signin' }: AuthFormProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [email, setEmail] = useState(isSupabaseMode ? '' : 'owner@ascent.store')
  const [password, setPassword] = useState(isSupabaseMode ? '' : 'ascent-demo')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [accountRole, setAccountRole] = useState<UserRole>('customer')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { signIn, registerCustomer, recoverPassword } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const selectedCredential = useMemo(
    () => demoCredentials.find((credential) => credential.role === selectedRole),
    [selectedRole],
  )

  const applyDemoRole = (role: UserRole) => {
    const credential = demoCredentials.find((item) => item.role === role)

    onRoleChange(role)
    if (credential) setEmail(credential.email)
  }

  const copy = modeCopy[mode]

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setError('')
    setNotice('')
    if (isSupabaseMode) {
      setPassword('')
      setConfirmPassword('')
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid email address.')
      return
    }

    const minimum = mode === 'create' && isSupabaseMode ? 12 : 8
    if (mode !== 'recover' && password.length < minimum) {
      setError(`Password must contain at least ${minimum} characters.`)
      return
    }
    if (mode === 'create' && isSupabaseMode && password !== confirmPassword) {
      setError('Passwords must match.')
      return
    }

    if (mode === 'create' && name.trim().length < 2) {
      setError('Enter your name to create an account.')
      return
    }

    setIsSubmitting(true)
    try {
      if (mode === 'recover') {
        setNotice(
          isSupabaseMode
            ? await recoverPassword(email.trim())
            : 'Password recovery is a local demonstration. Email delivery is available after Supabase Auth is connected.',
        )
        return
      }

      const user =
        mode === 'create'
          ? await registerCustomer(name.trim(), email.trim(), password, accountRole)
          : await signIn(email.trim(), password)

      const requestedPath = (location.state as { from?: string } | null)?.from
      const safeRequestedPath =
        requestedPath && requestedPath.startsWith('/') ? requestedPath : undefined
      navigate(
        safeRequestedPath ??
          (user.role === 'owner' ? '/owner' : user.role === 'staff' ? '/staff' : '/account'),
        { replace: true },
      )
    } catch (submitError) {
      if (submitError instanceof Error && submitError.message.startsWith('Account created.'))
        setNotice(submitError.message)
      else
        setError(
          submitError instanceof Error ? submitError.message : 'Unable to complete authentication.',
        )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <motion.section className="auth-panel" aria-labelledby="auth-title" layout>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-500">
          Secure access
        </p>
        <h2 id="auth-title" className="text-2xl font-extrabold text-ink-950 dark:text-white">
          {copy.title}
        </h2>
        <p className="text-sm leading-6 text-ink-600 dark:text-ink-300">{copy.copy}</p>
      </div>

      {mode === 'signin' && !isSupabaseMode && (
        <div className="role-switch" aria-label="Choose demo account type">
          {demoCredentials.map((credential) => (
            <button
              className={credential.role === selectedRole ? 'is-active' : ''}
              key={credential.role}
              onClick={() => applyDemoRole(credential.role)}
              type="button"
            >
              {credential.label}
            </button>
          ))}
        </div>
      )}

      <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
        {mode === 'create' && isSupabaseMode && (
          <label className="form-field">
            <span>Account type</span>
            <select
              value={accountRole}
              onChange={(event) => setAccountRole(event.target.value as UserRole)}
            >
              <option value="customer">Customer</option>
              <option value="staff">Staff — requires approval</option>
              <option value="owner">Admin / owner — requires approval</option>
            </select>
            {accountRole !== 'customer' && (
              <small>
                Your account starts with customer access. An existing owner must approve your{' '}
                {accountRole === 'owner' ? 'admin' : 'staff'} access in People.
              </small>
            )}
          </label>
        )}
        {mode === 'create' && (
          <label className="form-field">
            <span>Full name</span>
            <input
              autoComplete="name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              type="text"
              value={name}
            />
          </label>
        )}
        <label className="form-field">
          <span>Email</span>
          <input
            autoComplete="email"
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@store.com"
            type="email"
            value={email}
          />
        </label>

        {mode !== 'recover' && (
          <label className="form-field">
            <span>Password</span>
            <span className="password-input">
              <input
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                type={showPassword ? 'text' : 'password'}
                value={password}
              />
              <button
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((current) => !current)}
                type="button"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {mode === 'create' && isSupabaseMode && (
          <label className="form-field">
            <span>Confirm password</span>
            <input
              required
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repeat your password"
            />
            <small>Use at least 12 characters.</small>
          </label>
        )}
        {notice && (
          <p className="form-success" role="status">
            {notice}
          </p>
        )}

        <div className="grid gap-3 pt-1 sm:grid-cols-[1fr_auto]">
          <Button disabled={isSubmitting} fullWidth type="submit">
            {isSubmitting ? 'Please wait…' : copy.action}
          </Button>
          <Button
            className="min-w-32"
            onClick={() => changeMode(mode === 'signin' ? 'create' : 'signin')}
            variant="secondary"
          >
            {mode === 'signin' ? 'Create' : 'Sign in'}
          </Button>
        </div>
      </form>

      <div className="mt-5 flex flex-col gap-3 border-t border-ink-200 pt-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
        <button
          className="text-left text-sm font-bold text-ink-600 transition hover:text-ink-950 dark:text-ink-300 dark:hover:text-white"
          onClick={() => changeMode('recover')}
          type="button"
        >
          Forgot password?
        </button>
        <p className="text-sm leading-6 text-ink-500 dark:text-ink-300">
          {isSupabaseMode
            ? 'Your approved account role determines your workspace.'
            : mode === 'signin'
              ? selectedCredential?.hint
              : 'Staff and owner accounts cannot register publicly.'}
        </p>
      </div>

      <p className="mt-4 text-center text-xs leading-5 text-ink-500 dark:text-ink-300">
        {isSupabaseMode
          ? 'Sign in with your registered email, or create an account.'
          : 'Use a demo account or create a customer account.'}{' '}
        <Link className="font-bold text-brand-700 dark:text-brand-500" to="/">
          Return home
        </Link>
      </p>
    </motion.section>
  )
}
