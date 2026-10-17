"use server";

import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export type Credenciales = { nombre: string; email: string; password: string; telefono: string | null; tipo: "propietario" | "inquilino" };
export type AccesoState = { ok?: boolean; error?: string; credenciales?: Credenciales; mensaje?: string } | undefined;

const TIPOS = ["propietario", "inquilino"] as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Sin caracteres ambiguos (0/O, 1/l/I) para que se pueda dictar por teléfono o WhatsApp.
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function generarClave(largo = 12) {
  for (;;) {
    const c = Array.from({ length: largo }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
    if (/[A-Za-z]/.test(c) && /[0-9]/.test(c)) return c;
  }
}

const texto = (fd: FormData, k: string, max = 120) => String(fd.get(k) ?? "").trim().slice(0, max);

/** Registro de auditoría. Nunca incluye contraseñas. */
async function auditar(usuarioId: string, accion: string, entidadId: string | null, payload: Json) {
  try {
    const supabase = await createClient();
    await supabase.from("auditoria").insert({ usuario_id: usuarioId, accion, entidad: "clientes", entidad_id: entidadId, payload, fecha: new Date().toISOString() });
  } catch { /* la auditoría no debe romper la operación */ }
}

function traducirError(msg: string) {
  if (/already|registered|exists/i.test(msg)) return "Ya existe un usuario con ese email.";
  if (/fetch|network|ENOTFOUND|EAI_AGAIN|timeout/i.test(msg)) return "No hay conexión con Supabase. Revisá la URL del proyecto en .env.local.";
  return "No se pudo completar la operación. " + msg;
}

/** Crea un cliente NUEVO y su acceso al portal en un solo paso. */
export async function crearClienteConAcceso(_: AccesoState, fd: FormData): Promise<AccesoState> {
  const staff = await requireStaff(["titular"]);
  const nombre = texto(fd, "nombre", 80), apellido = texto(fd, "apellido", 80);
  const email = texto(fd, "email", 160).toLowerCase();
  const telefono = texto(fd, "telefono", 40) || null;
  const tipo = String(fd.get("tipo") ?? "") as (typeof TIPOS)[number];

  if (!nombre || !apellido) return { error: "Completá nombre y apellido." };
  if (!TIPOS.includes(tipo)) return { error: "Elegí si es propietario o inquilino." };
  if (!EMAIL.test(email)) return { error: "El email no es válido." };

  const password = generarClave();
  try {
    // La tabla clientes no tiene el email como único: sin este chequeo, si esa persona ya estaba cargada
    // (de un lead, una captación, etc., sin acceso todavía) esto crearía una fila NUEVA y duplicada en vez
    // de darle acceso a la que ya existe — quedaría con el historial (documentos, leads) huérfano, sin verse
    // desde el portal de la cuenta nueva.
    const supabaseCheck = await createClient();
    const { data: yaExiste } = await supabaseCheck.from("clientes").select("id,nombre,apellido,auth_id").eq("email", email).maybeSingle();
    if (yaExiste) {
      return {
        error: yaExiste.auth_id
          ? `Ya existe un acceso para ${yaExiste.nombre} ${yaExiste.apellido} con ese email. Usá "Nueva clave" en su fila en vez de crear uno nuevo.`
          : `Ya hay un cliente cargado (${yaExiste.nombre} ${yaExiste.apellido}) con ese email, sin acceso todavía. Buscalo en la lista y usá "Dar acceso" ahí en vez de crear uno nuevo, para no perder su historial.`,
      };
    }

    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      app_metadata: { rol: "cliente", tipo }, // solo modificable con la clave de servicio
      user_metadata: { debe_cambiar_clave: true, nombre },
    });
    if (error || !data.user) return { error: traducirError(error?.message ?? "sin respuesta") };

    const supabase = await createClient();
    const { data: cliente, error: e2 } = await supabase
      .from("clientes")
      .insert({ nombre, apellido, email, telefono, whatsapp: telefono, tipo, auth_id: data.user.id, acceso_activo: true,
                dni: null, cuit: null, direccion: null, observaciones: null, sucursal_id: null })
      .select("id").single();
    if (e2 || !cliente) {
      await admin.auth.admin.deleteUser(data.user.id); // deshacer: no dejar usuarios huérfanos
      return { error: traducirError(e2?.message ?? "no se pudo guardar el cliente") };
    }

    await auditar(staff.id, "crear_acceso_cliente", cliente.id, { tipo, email });
    revalidatePath("/panel/accesos");
    return { ok: true, credenciales: { nombre: `${nombre} ${apellido}`, email, password, telefono, tipo } };
  } catch (e) {
    return { error: traducirError((e as Error).message) };
  }
}

/** Da acceso al portal a un cliente que ya existe (cargado desde otro módulo). */
export async function darAcceso(_: AccesoState, fd: FormData): Promise<AccesoState> {
  const staff = await requireStaff(["titular"]);
  const clienteId = texto(fd, "clienteId", 60);
  const emailForm = texto(fd, "email", 160).toLowerCase();

  const supabase = await createClient();
  const { data: c } = await supabase.from("clientes").select("id,nombre,apellido,tipo,email,telefono,auth_id").eq("id", clienteId).maybeSingle();
  if (!c) return { error: "No encontramos al cliente." };
  if (c.auth_id) return { error: "Este cliente ya tiene acceso." };
  if (c.tipo !== "propietario" && c.tipo !== "inquilino") return { error: "Solo propietarios e inquilinos acceden al portal." };
  const email = (emailForm || c.email || "").toLowerCase();
  if (!EMAIL.test(email)) return { error: "Ingresá un email válido para el acceso." };

  const password = generarClave();
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      app_metadata: { rol: "cliente", tipo: c.tipo },
      user_metadata: { debe_cambiar_clave: true, nombre: c.nombre },
    });
    if (error || !data.user) return { error: traducirError(error?.message ?? "sin respuesta") };
    const { error: e2 } = await supabase.from("clientes").update({ auth_id: data.user.id, email, acceso_activo: true }).eq("id", c.id);
    if (e2) { await admin.auth.admin.deleteUser(data.user.id); return { error: traducirError(e2.message) }; }

    await auditar(staff.id, "dar_acceso_cliente", c.id, { tipo: c.tipo, email });
    revalidatePath("/panel/accesos");
    return { ok: true, credenciales: { nombre: `${c.nombre} ${c.apellido}`, email, password, telefono: c.telefono, tipo: c.tipo } };
  } catch (e) {
    return { error: traducirError((e as Error).message) };
  }
}

/** Genera una contraseña temporal nueva (el cliente deberá cambiarla al ingresar). */
export async function resetearClave(_: AccesoState, fd: FormData): Promise<AccesoState> {
  const staff = await requireStaff(["titular"]);
  const clienteId = texto(fd, "clienteId", 60);
  const supabase = await createClient();
  const { data: c } = await supabase.from("clientes").select("id,nombre,apellido,tipo,email,telefono,auth_id").eq("id", clienteId).maybeSingle();
  if (!c?.auth_id || (c.tipo !== "propietario" && c.tipo !== "inquilino")) return { error: "Este cliente no tiene acceso." };

  const password = generarClave();
  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(c.auth_id, { password, user_metadata: { debe_cambiar_clave: true } });
    if (error) return { error: traducirError(error.message) };
    await auditar(staff.id, "resetear_clave_cliente", c.id, {});
    return { ok: true, credenciales: { nombre: `${c.nombre} ${c.apellido}`, email: c.email ?? "", password, telefono: c.telefono, tipo: c.tipo } };
  } catch (e) {
    return { error: traducirError((e as Error).message) };
  }
}

/** Suspende o reactiva el acceso. La suspensión corta el acceso a los datos AL INSTANTE (RLS). */
export async function cambiarEstadoAcceso(_: AccesoState, fd: FormData): Promise<AccesoState> {
  const staff = await requireStaff(["titular"]);
  const clienteId = texto(fd, "clienteId", 60);
  const activar = String(fd.get("activar")) === "1";
  const supabase = await createClient();
  const { data: c } = await supabase.from("clientes").select("id,auth_id").eq("id", clienteId).maybeSingle();
  if (!c?.auth_id) return { error: "Este cliente no tiene acceso." };

  try {
    const { error } = await supabase.from("clientes").update({ acceso_activo: activar }).eq("id", c.id);
    if (error) return { error: traducirError(error.message) };
    // Además se bloquea el login en Auth (best-effort; el corte real e inmediato es RLS).
    await createAdminClient().auth.admin.updateUserById(c.auth_id, { ban_duration: activar ? "none" : "876000h" });
    await auditar(staff.id, activar ? "reactivar_acceso_cliente" : "suspender_acceso_cliente", c.id, {});
    revalidatePath("/panel/accesos");
    return { ok: true, mensaje: activar ? "Acceso reactivado." : "Acceso suspendido." };
  } catch (e) {
    return { error: traducirError((e as Error).message) };
  }
}
