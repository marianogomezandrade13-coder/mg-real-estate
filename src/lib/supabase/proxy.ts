import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export type RolSesion = "staff" | "cliente";
export type Claims = {
  sub?: string;
  app_metadata?: { rol?: RolSesion; tipo?: "propietario" | "inquilino" };
  user_metadata?: { debe_cambiar_clave?: boolean };
} | null;

/**
 * Refresca la sesión de Supabase en cada request y devuelve los claims verificados del JWT.
 * Si Supabase no responde, falla CERRADO: se trata como "sin sesión".
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  let claims: Claims = null;
  try {
    const { data } = await supabase.auth.getClaims();
    claims = (data?.claims as Claims) ?? null;
  } catch {
    claims = null;
  }
  return { response, claims };
}

/** Redirección que conserva las cookies de sesión refrescadas. */
export function redirectKeepingCookies(request: NextRequest, from: NextResponse, to: string) {
  const res = NextResponse.redirect(new URL(to, request.url));
  from.cookies.getAll().forEach((c) => res.cookies.set(c));
  return res;
}
