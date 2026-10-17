"use client";

import type { Database } from "@/types/database";
import { sb, subirArchivo } from "./panel-db";
import { construirContrato, type DatosContrato } from "./pdf/contrato";

export type ContratoRow = Database["public"]["Tables"]["contratos"]["Row"];

/** Próximo número correlativo (CONT-2026-0001…): toma el mayor del año actual. */
export async function siguienteNumeroContrato() {
  const anio = new Date().getFullYear();
  const { data } = await sb.from("contratos").select("cuerpo").not("cuerpo", "is", null).order("created_at", { ascending: false }).limit(200);
  const max = (data ?? []).reduce((m, r) => {
    const n = (r.cuerpo as { numero?: string } | null)?.numero;
    if (!n?.startsWith(`CONT-${anio}-`)) return m;
    return Math.max(m, parseInt(n.split("-")[2], 10) || 0);
  }, 0);
  return `CONT-${anio}-${String(max + 1).padStart(4, "0")}`;
}

/** Genera el PDF del contrato, lo guarda en el bucket privado `pdfs` y registra su ruta en `pdf_url`. */
export async function archivarPdfContrato(contratoId: string, numero: string, d: DatosContrato) {
  const doc = await construirContrato(numero, d);
  const path = `contratos/${contratoId}.pdf`;
  await subirArchivo("pdfs", path, doc.output("blob"));
  const { error } = await sb.from("contratos").update({ pdf_url: path }).eq("id", contratoId);
  if (error) throw new Error(error.message);
  return { doc, path };
}
