import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con la clave de servicio (service role): se salta RLS y puede crear usuarios.
 * Solo se importa desde código de servidor (`server-only` rompe el build si llega al navegador)
 * y SIEMPRE después de verificar que quien llama es titular (ver `requireStaff(["titular"])`).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
