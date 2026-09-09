import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { isSupabaseMode, requireSupabase } from '../../services/supabaseClient'
export function ResetPasswordPage() {
  const [password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[message,setMessage]=useState(''),[done,setDone]=useState(false),[busy,setBusy]=useState(false)
  const submit=async(event:FormEvent)=>{event.preventDefault();if(password!==confirm){setMessage('Passwords must match.');return}setBusy(true);try{const{error}=await requireSupabase().auth.updateUser({password});if(error)throw error;setDone(true);setMessage('Your password has been updated.')}catch(error){setMessage(error instanceof Error?error.message:'Password update failed.')}finally{setBusy(false)}}
  return <section className="centered-state"><p className="eyebrow">Account recovery</p><h1>Set a new password.</h1>{!isSupabaseMode?<p>Password recovery requires Supabase Auth. Ask your store owner for help with a local demo account.</p>:done?<p role="status">{message}</p>:<form className="operation-form" onSubmit={submit}><label className="field">New password<input required minLength={12} autoComplete="new-password" type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label><label className="field">Confirm password<input required minLength={12} autoComplete="new-password" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>{message&&<p role="alert" className="form-error">{message}</p>}<button className="button button-primary" disabled={busy}>{busy?'Updating…':'Update password'}</button></form>}<Link className="text-action" to="/login">Return to sign in</Link></section>
}

