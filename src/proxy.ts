import { NextResponse, type NextRequest } from "next/server";
import { updateSession, redirectKeepingCookies } from "@/lib/supabase/proxy";

/**
 * Primera barrera (rápida, sin consultar tablas): separa el PANEL del equipo del PORTAL de clientes.
 * No es la autorización real: cada página vuelve a verificar en el servidor (src/lib/auth.ts) y
 * la base de datos aplica RLS. Ver docs de Next: el proxy no debe ser la única defensa.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response, claims } = await updateSession(request);
  const rol = claims?.app_metadata?.rol;
  const go = (to: string) => redirectKeepingCookies(request, response, to);

  // Rutas de salida: siempre accesibles (cierran la sesión). Evitan bucles si la cuenta quedó sin acceso.
  if (pathname === "/portal/salir" || pathname === "/panel/salir") return response;

  // ---- Panel interno: solo equipo ----
  if (pathname.startsWith("/panel")) {
    if (rol === "staff") return pathname === "/panel/login" ? go("/panel/dashboard") : response;
    return go("/portal"); // clientes y visitantes: el único acceso es /portal
  }

  // ---- Portal: solo clientes ----
  if (pathname.startsWith("/portal")) {
    if (pathname === "/portal/admin") return go("/portal"); // ruta vieja
    const esLogin = pathname === "/portal";
    if (rol === "cliente") {
      const destino = `/portal/${claims?.app_metadata?.tipo ?? "propietario"}`;
      return esLogin ? go(destino) : response;
    }
    if (rol === "staff") return go("/panel/dashboard");
    return esLogin ? response : go("/portal");
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: ["/panel/:path*", "/portal/:path*"],
};
