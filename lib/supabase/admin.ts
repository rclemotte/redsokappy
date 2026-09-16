import { createClient } from "@supabase/supabase-js";

// Cliente ADMIN de Supabase (service role). SOLO se usa en el servidor
// (rutas /api). La llave nunca llega al navegador porque no lleva el
// prefijo NEXT_PUBLIC_. Configurar en Vercel: SUPABASE_SERVICE_ROLE_KEY.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
