import type { jsPDF } from "jspdf";
import { BRAND } from "@/lib/brand";

/** Paleta MG en RGB para jsPDF */
export const C = {
  forest: [22, 32, 27], bronce: [138, 101, 41], oro: [217, 188, 133], crema: [246, 243, 236],
  dorado: [246, 238, 221], texto: [31, 36, 33], suave: [103, 107, 99], linea: [229, 224, 216],
  verde: [31, 157, 91], rojo: [192, 80, 106],
} as const satisfies Record<string, readonly [number, number, number]>;
export type Color = readonly [number, number, number];

export const M = 18;            // margen lateral (mm)
export const ANCHO = 210 - 2 * M; // ancho útil

/** Logo oficial MG Real Estate: el mismo PNG del sitio (versión para fondo oscuro). Solo en el navegador. */
const LOGO = { src: "/brand/mg-logo-completo.png", ancho: 900, alto: 544 };
let logoCache: Promise<string> | null = null;
function logoDataUrl(): Promise<string> {
  logoCache ??= fetch(LOGO.src)
    .then((r) => { if (!r.ok) throw new Error("No se pudo cargar el logo"); return r.blob(); })
    .then((b) => new Promise<string>((ok, err) => {
      const fr = new FileReader();
      fr.onload = () => ok(String(fr.result));
      fr.onerror = () => err(new Error("No se pudo leer el logo"));
      fr.readAsDataURL(b);
    }))
    .catch((e) => { logoCache = null; throw e; });
  return logoCache;
}

export const dinero = (v: number, m: "USD" | "ARS" = "ARS") =>
  `${m === "USD" ? "USD" : "$"} ${Math.round(v).toLocaleString("es-AR")}`;

export const hoy = () => new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

export const fill = (d: jsPDF, c: Color) => d.setFillColor(c[0], c[1], c[2]);
export const draw = (d: jsPDF, c: Color) => d.setDrawColor(c[0], c[1], c[2]);
export const ink = (d: jsPDF, c: Color) => d.setTextColor(c[0], c[1], c[2]);

/** Crea el documento A4 con el membrete de MG y el pie con los datos de la inmobiliaria. */
export async function crearDoc(tipo: string, numero: string, fecha: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });

  // Membrete
  fill(doc, C.forest); doc.rect(0, 0, 210, 36, "F");
  fill(doc, C.oro); doc.rect(0, 36, 210, 0.8, "F");
  const altoLogo = 25;
  doc.addImage(await logoDataUrl(), "PNG", M, 5.5, (altoLogo * LOGO.ancho) / LOGO.alto, altoLogo);
  doc.setFont("helvetica", "bold"); doc.setFontSize(15); ink(doc, [255, 255, 255]);
  doc.text(tipo.toUpperCase(), 210 - M, 17, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); ink(doc, C.oro);
  doc.text(`${numero}  ·  ${fecha}`, 210 - M, 24, { align: "right" });

  pie(doc);
  return doc;
}

export function pie(doc: jsPDF) {
  const y = 284;
  draw(doc, C.linea); doc.setLineWidth(0.3); doc.line(M, y - 4, 210 - M, y - 4);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); ink(doc, C.suave);
  doc.text(`${BRAND.name}  ·  ${BRAND.address}`, 105, y, { align: "center" });
  doc.text(`${BRAND.phoneDisplay}  ·  ${BRAND.email}  ·  ${BRAND.matricula}`, 105, y + 4, { align: "center" });
}

/** Etiqueta pequeña sobre un valor. Devuelve la nueva Y. */
export function campo(doc: jsPDF, x: number, y: number, etiqueta: string, valor: string, ancho = 80) {
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); ink(doc, C.suave);
  doc.text(etiqueta.toUpperCase(), x, y, { charSpace: 0.4 });
  doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); ink(doc, C.texto);
  const lineas = doc.splitTextToSize(valor || "-", ancho) as string[];
  doc.text(lineas, x, y + 5.2);
  return y + 5.2 + lineas.length * 4.6 + 3;
}

/** Título de sección con filete dorado. */
export function seccion(doc: jsPDF, y: number, titulo: string, x = M) {
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); ink(doc, C.bronce);
  doc.text(titulo.toUpperCase(), x, y, { charSpace: 1.1 });
  draw(doc, C.oro); doc.setLineWidth(0.5); doc.line(x, y + 2, x + 14, y + 2);
  return y + 8;
}

/** Descarga el PDF (o lo devuelve como URL de blob si `abrir` es true, útil para vista previa). */
export function entregar(doc: jsPDF, nombre: string) {
  doc.save(nombre.endsWith(".pdf") ? nombre : `${nombre}.pdf`);
}
