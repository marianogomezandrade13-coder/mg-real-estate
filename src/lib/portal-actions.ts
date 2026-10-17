"use server";

import { requireCliente } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type Descarga = { url?: string; error?: string };
type Tipo = "documento" | "liquidacion" | "recibo" | "contrato";

/**
 * Devuelve un enlace TEMPORAL (90 s) al archivo. Se pide con la sesión del cliente: si el registro no es
 * suyo, la base no lo devuelve y el bucket tampoco firma el archivo (RLS en tabla y en storage).
 */
export async function descargar(tipo: Tipo, id: string): Promise<Descarga> {
  await requireCliente();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Archivo no válido." };
  const supabase = await createClient();

  let path: string | null = null;
  let bucket = "pdfs";
  if (tipo === "documento") {
    const { data } = await supabase.from("documentos").select("storage_path").eq("id", id).maybeSingle();
    path = data?.storage_path ?? null; bucket = "documentos";
  } else if (tipo === "liquidacion") {
    const { data } = await supabase.from("liquidaciones").select("pdf_url").eq("id", id).maybeSingle();
    path = data?.pdf_url ?? null;
  } else if (tipo === "recibo") {
    const { data } = await supabase.from("recibos").select("pdf_url").eq("id", id).maybeSingle();
    path = data?.pdf_url ?? null;
  } else {
    const { data } = await supabase.from("contratos").select("pdf_url").eq("id", id).maybeSingle();
    path = data?.pdf_url ?? null;
  }
  if (!path) return { error: "Este archivo todavía no está disponible." };

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 90, { download: true });
  if (error || !data?.signedUrl) return { error: "No pudimos generar la descarga. Probá de nuevo." };
  return { url: data.signedUrl };
}
