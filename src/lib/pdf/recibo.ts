import { C, M, ANCHO, crearDoc, campo, dinero, fill, draw, ink, entregar } from "./base";

export type ReciboData = {
  numero: string; cliente: string; concepto: string;
  honorarios: number; iva: number; total: number; moneda: "ARS" | "USD"; fecha: string;
};

/** Construye el recibo (A4) con desglose de IVA y código QR de verificación. */
export async function construirRecibo(r: ReciboData) {
  const doc = await crearDoc("Recibo", r.numero, r.fecha);
  const QR = (await import("qrcode")).default;

  // Recibimos de
  let y = 54;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); ink(doc, C.suave);
  doc.text("RECIBIMOS DE", M, y, { charSpace: 0.8 });
  doc.setFont("helvetica", "bold"); doc.setFontSize(20); ink(doc, C.texto);
  const nombre = doc.splitTextToSize(r.cliente || "-", ANCHO) as string[];
  doc.text(nombre, M, y + 9);
  y += 9 + nombre.length * 8 + 6;

  y = campo(doc, M, y, "En concepto de", r.concepto, ANCHO);
  y += 4;

  // Desglose
  const fila = (etiqueta: string, valor: string, yy: number, fuerte = false) => {
    doc.setFont("helvetica", fuerte ? "bold" : "normal"); doc.setFontSize(fuerte ? 12 : 10.5); ink(doc, fuerte ? C.texto : C.suave);
    doc.text(etiqueta, M + 5, yy);
    doc.setFont("helvetica", "bold"); ink(doc, fuerte ? C.bronce : C.texto); doc.setFontSize(fuerte ? 17 : 11);
    doc.text(valor, 210 - M - 5, yy, { align: "right" });
  };
  draw(doc, C.linea); doc.setLineWidth(0.3);
  fill(doc, [255, 255, 255]); doc.roundedRect(M, y, ANCHO, 46, 3, 3, "S");
  fila("Honorarios", dinero(r.honorarios, r.moneda), y + 11);
  doc.line(M + 5, y + 16, 210 - M - 5, y + 16);
  fila("IVA 21%", dinero(r.iva, r.moneda), y + 24);
  fill(doc, C.dorado); doc.roundedRect(M + 3, y + 30, ANCHO - 6, 13, 2, 2, "F");
  fila("TOTAL", dinero(r.total, r.moneda), y + 39, true);
  y += 62;

  // QR + firma
  const payload = `MG|RECIBO|${r.numero}|${r.total}|${r.moneda}|${r.fecha}`;
  doc.addImage(await QR.toDataURL(payload, { margin: 1, width: 320, color: { dark: "#16201B", light: "#FFFFFF" } }), "PNG", M, y, 34, 34);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); ink(doc, C.texto);
  doc.text("Código de verificación", M + 38, y + 8);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); ink(doc, C.suave);
  doc.text(doc.splitTextToSize(`Escaneá para comprobar el número (${r.numero}), el importe y la fecha de este recibo.`, 62) as string[], M + 38, y + 13);

  draw(doc, C.texto); doc.setLineWidth(0.3); doc.line(210 - M - 62, y + 28, 210 - M, y + 28);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); ink(doc, C.suave);
  doc.text("Firma y sello", 210 - M - 31, y + 33, { align: "center" });
  return doc;
}

export async function descargarRecibo(r: ReciboData) {
  entregar(await construirRecibo(r), `Recibo-${r.numero.replace("#", "")}`);
}
