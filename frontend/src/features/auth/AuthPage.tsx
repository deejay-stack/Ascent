import { useState } from 'react'
import type { UserRole } from '../../types/roles'
import { AuthForm } from './AuthForm'
import { AuthStory } from './AuthStory'

type AuthPageProps = {
  initialMode?: 'signin' | 'create' | 'recover'
}

export function AuthPage({ initialMode = 'signin' }: AuthPageProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole>(initialMode === 'create' ? 'customer' : 'owner')

  return (
    <div className="auth-page">
      <div className="auth-layout">
        <AuthStory />
        <aside className="auth-column" id="access">
          <AuthForm
            initialMode={initialMode}
            onRoleChange={setSelectedRole}
            selectedRole={selectedRole}
          />
        </aside>
      </div>
    </div>
  )
}
