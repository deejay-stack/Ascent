import { createClient } from '@supabase/supabase-js'
import { required } from './env.mjs'
export const supabaseAdmin = createClient(
  required('SUPABASE_URL'),
  process.env.SUPABASE_SECRET_KEY || required('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { autoRefreshToken: false, persistSession: false } },
)
