import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type RolStaff = "titular" | "contable";
export type TipoCliente = "propietario" | "inquilino";

export type SesionStaff = { id: string; authId: string; nombre: string; rol: RolStaff; email: string };
export type SesionCliente = {
  id: string; authId: string; nombre: string; apellido: string; tipo: TipoCliente; email: string;
  debeCambiarClave: boolean;
};

/** Staff autenticado (verificado contra el servidor de Auth y la tabla `usuarios`), o null. */
export const getStaff = cache(async (): Promise<SesionStaff | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("usuarios").select("id,nombre,rol,activo").eq("auth_id", user.id).maybeSingle();
  if (!data || !data.activo) return null;
  return { id: data.id, authId: user.id, nombre: data.nombre, rol: data.rol as RolStaff, email: user.email ?? "" };
});

/** Cliente del portal autenticado (propietario o inquilino), o null. */
export const getCliente = cache(async (): Promise<SesionCliente | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("clientes").select("id,nombre,apellido,tipo,acceso_activo").eq("auth_id", user.id).maybeSingle();
  if (!data || !data.acceso_activo || (data.tipo !== "propietario" && data.tipo !== "inquilino")) return null;
  return {
    id: data.id, authId: user.id, nombre: data.nombre, apellido: data.apellido, tipo: data.tipo,
    email: user.email ?? "", debeCambiarClave: user.user_metadata?.debe_cambiar_clave === true,
  };
});

/** Exige equipo (y opcionalmente un rol). Si no cumple, redirige: nunca devuelve datos ajenos. */
export async function requireStaff(roles?: RolStaff[]) {
  const s = await getStaff();
  if (!s) redirect("/panel/salir"); // sesión sin permisos → se cierra (evita bucle con el proxy)
  if (roles && !roles.includes(s.rol)) redirect("/panel/dashboard");
  return s;
}

/** Exige un cliente del tipo indicado. Un inquilino no puede abrir la pantalla de propietario ni al revés. */
export async function requireCliente(tipo?: TipoCliente) {
  const c = await getCliente();
  if (!c) redirect("/portal/salir"); // acceso suspendido o cuenta inexistente → se cierra la sesión
  if (tipo && c.tipo !== tipo) redirect(`/portal/${c.tipo}`);
  return c;
}
