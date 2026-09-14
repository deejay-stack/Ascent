import '../src/env.mjs'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '../src/supabase.mjs'
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const started = Date.now()
const signed = await client.auth.signInWithPassword({
  email: process.env.ASCENT_OWNER_EMAIL,
  password: process.env.ASCENT_OWNER_PASSWORD,
})
console.log('Configured owner sign-in:', {
  ok: !!signed.data.session,
  code: signed.error?.code,
  status: signed.error?.status,
  ms: Date.now() - started,
})
if (signed.data.session) {
  for (let i = 0; i < 3; i++) {
    const began = Date.now()
    const result = await supabaseAdmin.auth.getUser(signed.data.session.access_token)
    console.log('Server session verification:', {
      ok: !!result.data.user,
      code: result.error?.code,
      status: result.error?.status,
      ms: Date.now() - began,
    })
  }
}
