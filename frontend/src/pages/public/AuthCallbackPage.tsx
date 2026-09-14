import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
export function AuthCallbackPage() {
  const {user,isLoading}=useAuth(),navigate=useNavigate()
  useEffect(()=>{if(user)navigate(user.role==='owner'?'/owner':user.role==='staff'?'/staff':'/account',{replace:true})},[user,navigate])
  return <section className="centered-state"><h1>{isLoading?'Restoring your session…':'Email confirmation'}</h1><p>If your email is confirmed, you can sign in to continue.</p><Link className="primary-link" to="/login">Sign in</Link></section>
}

