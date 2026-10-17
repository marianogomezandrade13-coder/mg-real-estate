import { C, M, ANCHO, crearDoc, campo, seccion, dinero, hoy, fill, draw, ink, entregar } from "./base";

export type LiquidacionData = {
  propietario: string; propiedad: string; periodo: string;
  alquiler: number; comision: number; gastos: number; retencion: number; estado: string;
};

export const netoLiquidacion = (l: Pick<LiquidacionData, "alquiler" | "comision" | "gastos" | "retencion">) =>
  l.alquiler - l.comision - l.gastos - l.retencion;

/** Liquidación al propietario: alquiler cobrado - comisión - gastos - retención = neto a transferir. */
export async function construirLiquidacion(l: LiquidacionData) {
  const fecha = hoy();
  const numero = `LIQ · ${l.periodo}`;
  const doc = await crearDoc("Liquidación", numero, fecha);
  const neto = netoLiquidacion(l);

  let y = 54;
  y = seccion(doc, y, "Datos de la liquidación");
  const yA = campo(doc, M, y, "Propietario", l.propietario, 80);
  const yB = campo(doc, M + 95, y, "Período", l.periodo, 70);
  y = Math.max(yA, yB);
  const yC = campo(doc, M, y, "Propiedad", l.propiedad, 80);
  const yD = campo(doc, M + 95, y, "Estado", l.estado, 70);
  y = Math.max(yC, yD) + 4;

  y = seccion(doc, y, "Detalle");
  const linea = (etiqueta: string, valor: number, signo: 1 | -1, color: readonly [number, number, number]) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(11); ink(doc, C.texto);
    doc.text(etiqueta, M + 3, y);
    doc.setFont("helvetica", "bold"); ink(doc, color);
    doc.text(`${signo < 0 ? "-" : ""}${dinero(Math.abs(valor))}`, 210 - M - 3, y, { align: "right" });
    draw(doc, C.linea); doc.setLineWidth(0.3); doc.line(M, y + 3.5, 210 - M, y + 3.5);
    y += 11;
  };
  linea("Alquiler cobrado", l.alquiler, 1, C.verde);
  linea("Comisión de administración", l.comision, -1, C.rojo);
  linea("Gastos varios", l.gastos, -1, C.rojo);
  linea("Retención", l.retencion, -1, C.rojo);

  y += 2;
  fill(doc, C.dorado); doc.roundedRect(M, y, ANCHO, 18, 3, 3, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); ink(doc, C.texto);
  doc.text("NETO A TRANSFERIR", M + 5, y + 11.2);
  doc.setFontSize(19); ink(doc, C.bronce);
  doc.text(dinero(neto), 210 - M - 5, y + 12, { align: "right" });
  y += 40;

  draw(doc, C.texto); doc.setLineWidth(0.3);
  doc.line(M, y, M + 65, y); doc.line(210 - M - 65, y, 210 - M, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); ink(doc, C.suave);
  doc.text("Por MG Real Estate", M + 32, y + 5, { align: "center" });
  doc.text("Conformidad del propietario", 210 - M - 32, y + 5, { align: "center" });
  return doc;
}

export async function descargarLiquidacion(l: LiquidacionData) {
  entregar(await construirLiquidacion(l), `Liquidacion-${l.periodo.replace(/\s+/g, "-")}-${l.propietario.split(",")[0].replace(/\s+/g, "")}`);
}
