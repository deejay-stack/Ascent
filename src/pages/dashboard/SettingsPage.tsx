import { useState, type FormEvent } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { settingsService } from '../../services/settingsService'
export function SettingsPage() {
  const {user}=useAuth()
  const [settings,setSettings]=useState(()=>settingsService.get()),[message,setMessage]=useState('')
  const submit=async(e:FormEvent)=>{e.preventDefault();if(!user)return;try{await settingsService.save(settings,user);setMessage('Store preferences saved. New POS bills will use this tax rate.')}catch(e){setMessage(e instanceof Error?e.message:'Unable to save.')}}
  return <section className="operations-page"><header className="operations-heading"><div><p className="eyebrow">Store preferences</p><h2>Settings</h2></div></header><form className="operation-form report-panel" onSubmit={submit}><label className="field">Store name<input required value={settings.name} onChange={e=>setSettings({...settings,name:e.target.value})}/></label><label className="field">Store address<input required value={settings.address} onChange={e=>setSettings({...settings,address:e.target.value})}/></label><label className="field">Default demo tax (%)<input required type="number" min="0" max="100" step=".01" value={settings.taxRate} onChange={e=>setSettings({...settings,taxRate:Number(e.target.value)})}/></label><p className="muted">These preferences are stored on this browser for development.</p><button className="button button-primary">Save settings</button><p role="status">{message}</p></form></section>
}
