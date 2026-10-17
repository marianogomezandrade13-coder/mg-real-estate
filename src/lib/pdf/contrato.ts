import { C, M, ANCHO, crearDoc, pie, hoy, draw, ink, entregar } from "./base";
import { armarClausulas, tituloContrato, type DatosContrato, type Clausula } from "@/lib/contratos-clausulas";

export type { DatosContrato };

/** Contrato armado con los datos cargados, adaptado al tipo de operación e inmueble. */
export async function construirContrato(numero: string, d: DatosContrato) {
  const fecha = hoy();
  const titulo = tituloContrato(d);
  const doc = await crearDoc(titulo, numero, fecha);
  const clausulas = armarClausulas(d);

  let y = 48;

  doc.setFont("helvetica", "bold"); doc.setFontSize(13); ink(doc, C.texto);
  doc.text(titulo, 105, y, { align: "center" });
  y += 9;

  const numeroRomano = (n: number) => ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][n - 1] ?? String(n);
  const escribirClausula = (n: number, c: Clausula) => {
    if (y > 255) { doc.addPage(); pie(doc); y = 24; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); ink(doc, C.bronce);
    doc.text(`CLÁUSULA ${numeroRomano(n)} — ${c.titulo.toUpperCase()}`, M, y);
    y += 5.5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); ink(doc, C.texto);
    const lineas = doc.splitTextToSize(c.texto, ANCHO) as string[];
    for (const ln of lineas) {
      if (y > 262) { doc.addPage(); pie(doc); y = 24; doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); ink(doc, C.texto); }
      doc.text(ln, M, y); y += 4.6;
    }
    y += 4;
  };
  clausulas.forEach((c, i) => escribirClausula(i + 1, c));

  // Lugar y fecha
  if (y > 255) { doc.addPage(); pie(doc); y = 24; }
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); ink(doc, C.texto);
  doc.text(`En ${d.lugarFirma || "Mendoza"}, a los ${new Date().getDate()} días del mes de ${new Date().toLocaleDateString("es-AR", { month: "long" })} de ${new Date().getFullYear()}, se firman dos ejemplares de un mismo tenor y a un solo efecto.`, M, y, { maxWidth: ANCHO });
  y += 16;

  // Firmas
  if (y > 245) { doc.addPage(); pie(doc); y = 40; }
  const firmar = (x: number, p: DatosContrato["parteA"]) => {
    draw(doc, C.texto); doc.setLineWidth(0.3); doc.line(x, y, x + 75, y);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); ink(doc, C.texto);
    doc.text(p.nombre, x + 37.5, y + 5, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); ink(doc, C.suave);
    doc.text(`${p.rol}${p.dni ? ` · DNI/CUIT ${p.dni}` : ""}`, x + 37.5, y + 9.5, { align: "center" });
  };
  firmar(M, d.parteA); firmar(210 - M - 75, d.parteB);

  return doc;
}

export async function descargarContrato(numero: string, d: DatosContrato) {
  entregar(await construirContrato(numero, d), `${tituloContrato(d).replace(/\s+/g, "-")}-${numero}`);
}
