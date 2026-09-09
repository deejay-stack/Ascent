import { createClient } from '@supabase/supabase-js'
import { mockStorage } from './storage/mockStorage'
export const isSupabaseMode = import.meta.env.VITE_DATA_MODE === 'supabase'
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
export const supabaseClient =
  isSupabaseMode && url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: {
            getItem: mockStorage.getText,
            setItem: mockStorage.setText,
            removeItem: mockStorage.remove,
          },
        },
      })
    : null
export function requireSupabase() {
  if (!supabaseClient)
    throw new Error(
      'Supabase mode needs VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local.',
    )
  return supabaseClient
}
