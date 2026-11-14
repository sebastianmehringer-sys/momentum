import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** false, wenn die .env fehlt oder unvollständig ist */
export const supabaseConfigured = Boolean(url && key)

export const supabase = createClient(url || 'https://fehlt.supabase.co', key || 'fehlt', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
