"use server";

import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export type CredencialesStaff = { id: string; nombre: string; email: string; password: string; rol: "titular" | "contable" };
export type ConfigState = { ok?: boolean; error?: string; credenciales?: CredencialesStaff; mensaje?: string } | undefined;

const ROLES = ["titular", "contable"] as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Sin caracteres ambiguos (0/O, 1/l/I) para que se pueda dictar por teléfono.
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function generarClave(largo = 12) {
  for (;;) {
    const c = Array.from({ length: largo }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
    if (/[A-Za-z]/.test(c) && /[0-9]/.test(c)) return c;
  }
}

const texto = (fd: FormData, k: string, max = 120) => String(fd.get(k) ?? "").trim().slice(0, max);

async function auditar(usuarioId: string, accion: string, entidadId: string | null, payload: Json) {
  try {
    const supabase = await createClient();
    await supabase.from("auditoria").insert({ usuario_id: usuarioId, accion, entidad: "usuarios", entidad_id: entidadId, payload, fecha: new Date().toISOString() });
  } catch { /* la auditoría no debe romper la operación */ }
}

function traducirError(msg: string) {
  if (/already|registered|exists/i.test(msg)) return "Ya existe un usuario con ese email.";
  if (/fetch|network|ENOTFOUND|EAI_AGAIN|timeout/i.test(msg)) return "No hay conexión con Supabase.";
  return "No se pudo completar la operación. " + msg;
}

/** Crea un usuario del equipo (con acceso al panel). Solo la titular. */
export async function crearUsuarioStaff(_: ConfigState, fd: FormData): Promise<ConfigState> {
  const staff = await requireStaff(["titular"]);
  const nombre = texto(fd, "nombre", 80);
  const email = texto(fd, "email", 160).toLowerCase();
  const rol = String(fd.get("rol") ?? "") as (typeof ROLES)[number];

  if (!nombre) return { error: "Completá el nombre." };
  if (!EMAIL.test(email)) return { error: "El email no es válido." };
  if (!ROLES.includes(rol)) return { error: "Elegí el rol: titular o contable." };

  const password = generarClave();
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      app_metadata: { rol: "staff" }, // el rol de equipo (titular/contable) vive en la tabla `usuarios`, no acá
      user_metadata: { nombre },
    });
    if (error || !data.user) return { error: traducirError(error?.message ?? "sin respuesta") };

    const supabase = await createClient();
    const { data: usuario, error: e2 } = await supabase
      .from("usuarios").insert({ auth_id: data.user.id, nombre, email, rol, activo: true, sucursal_id: null }).select("id").single();
    if (e2 || !usuario) {
      await admin.auth.admin.deleteUser(data.user.id); // deshacer: no dejar usuarios huérfanos en Auth
      return { error: traducirError(e2?.message ?? "no se pudo guardar el usuario") };
    }

    await auditar(staff.id, "crear_usuario_staff", usuario.id, { rol, email });
    revalidatePath("/panel/configuracion");
    return { ok: true, credenciales: { id: usuario.id, nombre, email, password, rol } };
  } catch (e) {
    return { error: traducirError((e as Error).message) };
  }
}

/** Suspende o reactiva el acceso al panel de un integrante del equipo. */
export async function alternarActivoUsuario(_: ConfigState, fd: FormData): Promise<ConfigState> {
  const staff = await requireStaff(["titular"]);
  const usuarioId = texto(fd, "usuarioId", 60);
  const activar = String(fd.get("activar")) === "1";
  if (usuarioId === staff.id) return { error: "No podés desactivar tu propio usuario." };

  const supabase = await createClient();
  const { data: u } = await supabase.from("usuarios").select("id,auth_id").eq("id", usuarioId).maybeSingle();
  if (!u) return { error: "No encontramos ese usuario." };

  try {
    const { error } = await supabase.from("usuarios").update({ activo: activar }).eq("id", u.id);
    if (error) return { error: traducirError(error.message) };
    // Además se bloquea el login en Auth (best-effort; el corte real e inmediato es la tabla `usuarios`).
    await createAdminClient().auth.admin.updateUserById(u.auth_id, { ban_duration: activar ? "none" : "876000h" });
    await auditar(staff.id, activar ? "reactivar_usuario_staff" : "suspender_usuario_staff", u.id, {});
    revalidatePath("/panel/configuracion");
    return { ok: true, mensaje: activar ? "Usuario reactivado." : "Usuario desactivado." };
  } catch (e) {
    return { error: traducirError((e as Error).message) };
  }
}

/** Actualiza los porcentajes de comisión usados en Liquidaciones y Tasaciones. */
export async function guardarComisiones(_: ConfigState, fd: FormData): Promise<ConfigState> {
  const staff = await requireStaff(["titular"]);
  const n = (k: string) => { const v = parseFloat(String(fd.get(k) ?? "")); return Number.isFinite(v) ? v : NaN; };
  const admin_alquiler_pct = n("admin"), venta_pct = n("venta"), tasacion_pct = n("tasacion");
  for (const v of [admin_alquiler_pct, venta_pct, tasacion_pct]) if (!(v >= 0 && v <= 100)) return { error: "Los porcentajes deben estar entre 0 y 100." };

  const supabase = await createClient();
  const { data: fila } = await supabase.from("comisiones").select("id").is("sucursal_id", null).limit(1).maybeSingle();
  const { error } = fila
    ? await supabase.from("comisiones").update({ admin_alquiler_pct, venta_pct, tasacion_pct }).eq("id", fila.id)
    : await supabase.from("comisiones").insert({ admin_alquiler_pct, venta_pct, tasacion_pct, sucursal_id: null });
  if (error) return { error: traducirError(error.message) };

  await auditar(staff.id, "actualizar_comisiones", null, { admin_alquiler_pct, venta_pct, tasacion_pct });
  revalidatePath("/panel/configuracion");
  return { ok: true, mensaje: "Comisiones actualizadas." };
}
