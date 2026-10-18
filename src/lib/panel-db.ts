"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/** Cliente de Supabase del panel (navegador). Usa la sesión del equipo: la base aplica RLS según el rol. */
export const sb = createBrowserClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export type Cliente = Pick<Database["public"]["Tables"]["clientes"]["Row"], "id" | "nombre" | "apellido" | "tipo" | "email" | "telefono" | "dni" | "cuit">;
export type TipoCliente = Cliente["tipo"];

export const nombreCliente = (c?: Pick<Cliente, "nombre" | "apellido"> | null) => (c ? `${c.apellido}, ${c.nombre}` : "—");
export const dniCliente = (c?: Pick<Cliente, "dni" | "cuit"> | null) => c?.dni || c?.cuit || "";

/** YYYY-MM-DD de hoy en hora local */
export const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** "2026-09-21" → "21/09/2026" */
export const fechaAR = (iso?: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");

/** Lanza si falla (antes devolvía `[]` en silencio y las pantallas mostraban "sin clientes" en vez de un error real). */
export async function listarClientes(): Promise<Cliente[]> {
  const { data, error } = await sb.from("clientes").select("id,nombre,apellido,tipo,email,telefono,dni,cuit").order("apellido");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Sube un PDF al bucket privado y devuelve la ruta (lo que se guarda en `pdf_url`). Lanza si falla. */
export async function subirArchivo(bucket: "pdfs" | "documentos", path: string, blob: Blob, contentType = "application/pdf") {
  const { error } = await sb.storage.from(bucket).upload(path, blob, { contentType, upsert: true });
  if (error) throw new Error(error.message);
  return path;
}

/** Enlace temporal (60 s) para descargar un archivo privado. */
export async function urlTemporal(bucket: "pdfs" | "documentos", path: string) {
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 60, { download: true });
  if (error || !data) throw new Error(error?.message ?? "No se pudo generar el enlace");
  return data.signedUrl;
}

/** Teléfono → número de WhatsApp (Argentina). null si no hay datos suficientes. */
export function telefonoWa(t?: string | null) {
  const d = (t ?? "").replace(/\D/g, "");
  if (d.length < 8) return null;
  return d.startsWith("54") ? d : `549${d.replace(/^0+/, "").replace(/^15/, "")}`;
}

/** Comisión de administración pactada para un alquiler (guardada en el contrato). null = se usa la comisión general. */
export function pctDeCuerpo(cuerpo: unknown): number | null {
  if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo)) return null;
  const v = (cuerpo as Record<string, unknown>).comision_pct;
  return typeof v === "number" && v >= 0 && v <= 100 ? v : null;
}

/** Texto del formulario → porcentaje válido, null si está vacío, undefined si es inválido. */
export function leerPct(texto: string): number | null | undefined {
  const t = texto.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : undefined;
}
