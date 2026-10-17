"use client";

import type { Database } from "@/types/database";
import type { Comparable, Operacion } from "./tasacion-calculo";
import { sb, subirArchivo } from "./panel-db";
import { construirTasacion, type TasacionData } from "./pdf/tasacion";

export type Tasacion = Database["public"]["Tables"]["tasaciones"]["Row"];

/**
 * La tabla `tasaciones` no tiene columnas aparte para el párrafo de la IA, la operación (venta/alquiler/alquiler
 * temporal) ni los comparables relevados: se guardan juntos con las notas propias del tasador en `observaciones`,
 * con un rótulo para distinguirlos al releer.
 */
export function combinarObservaciones(
  informeIA: string | null | undefined, observaciones: string, operacionLabel?: string, comparables?: Comparable[], esFallback?: boolean
) {
  const partes: string[] = [];
  if (operacionLabel) partes.push(`Operación: ${operacionLabel}`);
  const validos = (comparables ?? []).filter((c) => c.precio > 0);
  if (validos.length) {
    partes.push(
      `Comparables relevados (método comparativo):\n` +
      validos.map((c) => `- ${c.portal}: ${c.direccion || "sin dirección"} · USD ${Math.round(c.precio).toLocaleString("es-AR")}${c.m2 ? ` (${c.m2} m²)` : ""}${c.link ? ` · ${c.link}` : ""}`).join("\n")
    );
  }
  if (informeIA?.trim()) partes.push(`Fundamentación (${esFallback ? "plantilla automática, sin IA" : "análisis con IA"}):\n${informeIA.trim()}`);
  if (observaciones.trim()) partes.push(`Observaciones del tasador:\n${observaciones.trim()}`);
  return partes.join("\n\n");
}

/**
 * La operación no tiene columna propia: se lee del rótulo "Operación: …" que `combinarObservaciones` deja
 * al principio del texto. Las tasaciones guardadas antes de sumar este campo no lo tienen: se asume "venta"
 * SOLO en ese caso (eran todas de venta), nunca como respaldo genérico para no mostrar mal una de alquiler.
 */
export function operacionDeObservaciones(observaciones: string | null): Operacion {
  if (observaciones?.startsWith("Operación: Alquiler temporal")) return "alquiler_temporal";
  if (observaciones?.startsWith("Operación: Alquiler")) return "alquiler";
  return "venta";
}

/** Próximo número correlativo (TAS-0001, TAS-0002…): toma el mayor existente para no repetir aunque se borren tasaciones. */
export async function siguienteNumeroTasacion() {
  const { data } = await sb.from("tasaciones").select("numero").order("numero", { ascending: false }).limit(50);
  const max = (data ?? []).reduce((m, r) => Math.max(m, parseInt(r.numero.replace(/\D/g, ""), 10) || 0), 0);
  return `TAS-${String(max + 1).padStart(4, "0")}`;
}

/**
 * Genera el PDF del informe, lo guarda en el bucket privado `pdfs` y registra su ruta en `pdf_url`.
 * `observaciones` ya trae combinado el párrafo de la IA (si lo hubo) + las notas del tasador: se guardan
 * juntas porque la tabla `tasaciones` no tiene una columna aparte para el texto de la IA.
 */
export async function archivarPdfTasacion(t: Tasacion) {
  const doc = await construirTasacion({
    numero: t.numero, direccion: t.direccion, tipo: t.tipo, estado: t.estado_conservacion ?? "-", zona: t.zona ?? "-",
    operacion: operacionDeObservaciones(t.observaciones),
    antiguedad: t.antiguedad_anios ?? 0, m2Terreno: t.m2_terreno ?? 0, m2Cubierto: t.m2_cubierto ?? 0,
    precioTerreno: t.precio_m2_terreno ?? 0, precioCubierto: t.precio_m2_cubierto ?? 0,
    transporte: t.score_transporte ?? 0, servicios: t.score_servicios ?? 0, seguridad: t.score_seguridad ?? 0, entorno: t.score_entorno ?? 0,
    observaciones: t.observaciones ?? "",
    min: t.valor_min ?? 0, rec: t.valor_recomendado ?? 0, opt: t.valor_optimo ?? 0,
    valorM2: operacionDeObservaciones(t.observaciones) === "alquiler_temporal" ? 0 : t.m2_cubierto ? (t.valor_recomendado ?? 0) / t.m2_cubierto : 0,
  } satisfies TasacionData & { numero: string });
  const path = `tasaciones/${t.id}.pdf`;
  await subirArchivo("pdfs", path, doc.output("blob"));
  const { error } = await sb.from("tasaciones").update({ pdf_url: path }).eq("id", t.id);
  if (error) throw new Error(error.message);
  return { doc, path };
}
