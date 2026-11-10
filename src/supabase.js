import { createClient } from '@supabase/supabase-js'

// Estas dos claves son públicas por diseño: la seguridad de los datos la dan
// el inicio de sesión y las políticas RLS de la base de datos.
const SUPABASE_URL = 'https://gcionnovhpskxaaugzmf.supabase.co'
const SUPABASE_KEY = 'sb_publishable_Z3XG75saZ9Lx6DOndiJ81A_uP_KNoxE'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
