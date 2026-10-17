"use client";

import type { Database } from "@/types/database";
import { sb, subirArchivo, fechaAR, nombreCliente, type Cliente } from "./panel-db";
import { construirRecibo } from "./pdf/recibo";

export type ReciboRow = Database["public"]["Tables"]["recibos"]["Row"];

/** Próximo número correlativo (#0001, #0002…): toma el MAYOR existente, así no se repite aunque se borren recibos. */
export async function siguienteNumeroRecibo() {
  const { data } = await sb.from("recibos").select("numero").order("numero", { ascending: false }).limit(50);
  const max = (data ?? []).reduce((m, r) => Math.max(m, parseInt(r.numero.replace(/\D/g, ""), 10) || 0), 0);
  return `#${String(max + 1).padStart(4, "0")}`;
}

/**
 * Genera el PDF del recibo, lo guarda en el bucket privado `pdfs` y registra su ruta en `pdf_url`
 * (así el cliente lo descarga desde su portal). Devuelve el documento para poder también bajarlo.
 */
export async function archivarPdfRecibo(r: ReciboRow, cliente: Pick<Cliente, "nombre" | "apellido"> | undefined) {
  const doc = await construirRecibo({
    numero: r.numero, cliente: nombreCliente(cliente), concepto: r.concepto, honorarios: r.honorarios, iva: r.iva, total: r.total,
    moneda: r.moneda, fecha: fechaAR(r.fecha),
  });
  const path = `recibos/${r.id}.pdf`;
  await subirArchivo("pdfs", path, doc.output("blob"));
  const { error } = await sb.from("recibos").update({ pdf_url: path }).eq("id", r.id);
  if (error) throw new Error(error.message);
  return { doc, path };
}
