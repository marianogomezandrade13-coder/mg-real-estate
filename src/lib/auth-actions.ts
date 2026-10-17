"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MIN_CLAVE } from "@/lib/auth-constants";

export type FormState = { error?: string } | undefined;

const MSG_CREDENCIALES = "Email o contraseña incorrectos.";
const MSG_RED = "No pudimos conectar con el servidor. Probá de nuevo en unos minutos.";

function leerCredenciales(fd: FormData) {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  return { email, password, ok: email.length > 3 && email.includes("@") && password.length > 0 };
}

/** Inicia sesión y devuelve el usuario, o un mensaje genérico (nunca dice si el email existe). */
async function iniciarSesion(email: string, password: string) {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const esCredencial = error.status === 400 || error.status === 401 || /invalid/i.test(error.message);
      return { supabase, error: esCredencial ? MSG_CREDENCIALES : MSG_RED };
    }
    return { supabase, user: data.user };
  } catch {
    return { supabase, error: MSG_RED };
  }
}

/** Login único: clientes van al portal y el equipo al panel. */
export async function loginCliente(_: FormState, fd: FormData): Promise<FormState> {
  const { email, password, ok } = leerCredenciales(fd);
  if (!ok) return { error: MSG_CREDENCIALES };

  const r = await iniciarSesion(email, password);
  if (!r.user) return { error: r.error };

  const { data: cliente } = await r.supabase
    .from("clientes").select("tipo").eq("auth_id", r.user.id).maybeSingle();
  if (!cliente || (cliente.tipo !== "propietario" && cliente.tipo !== "inquilino")) {
    const { data: staff } = await r.supabase.from("usuarios").select("activo").eq("auth_id", r.user.id).maybeSingle();
    if (staff?.activo) redirect("/panel/dashboard"); // el equipo entró por el portal: va a su panel
    await r.supabase.auth.signOut();
    return { error: "Esta cuenta no tiene acceso al portal de clientes." };
  }
  redirect(r.user.user_metadata?.debe_cambiar_clave === true ? "/portal/clave" : `/portal/${cliente.tipo}`);
}

export async function salirStaff() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/portal");
}

export async function salirCliente() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/portal");
}

/** Cambio de contraseña de quien tiene sesión (primer ingreso con clave temporal o cambio voluntario). */
export async function cambiarClave(_: FormState, fd: FormData): Promise<FormState> {
  const nueva = String(fd.get("nueva") ?? "");
  const repetir = String(fd.get("repetir") ?? "");
  if (nueva.length < MIN_CLAVE) return { error: `La contraseña debe tener al menos ${MIN_CLAVE} caracteres.` };
  if (!/[A-Za-z]/.test(nueva) || !/[0-9]/.test(nueva)) return { error: "Usá letras y números en la contraseña." };
  if (nueva !== repetir) return { error: "Las contraseñas no coinciden." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/portal");

  try {
    const { error } = await supabase.auth.updateUser({ password: nueva, data: { debe_cambiar_clave: false } });
    if (error) return { error: /same/i.test(error.message) ? "La nueva contraseña debe ser distinta de la actual." : "No pudimos actualizar la contraseña." };
  } catch {
    return { error: MSG_RED };
  }
  redirect(user.app_metadata?.rol === "staff" ? "/panel/dashboard" : `/portal/${user.app_metadata?.tipo ?? "propietario"}`);
}
