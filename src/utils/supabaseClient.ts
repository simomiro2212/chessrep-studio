import { createClient } from '@supabase/supabase-js';

// Vite espone le variabili VITE_* tramite import.meta.env.
// Il tipo è già dichiarato in vite/client, aggiunto via tsconfig "types" o /// reference.
const supabaseUrl: string = (import.meta as unknown as { env: Record<string, string> }).env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey: string = (import.meta as unknown as { env: Record<string, string> }).env.VITE_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "[Supabase] Variabili d'ambiente mancanti: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
