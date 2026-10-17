import { BRAND } from "@/lib/brand";
import { OPERACIONES, type Comparable, type Operacion } from "@/lib/tasacion-calculo";
import { C, M, ANCHO, crearDoc, campo, seccion, pie, hoy, fill, draw, ink, entregar } from "./base";

export type TasacionData = {
  direccion: string; tipo: string; estado: string; zona: string; antiguedad: number;
  operacion: Operacion;
  m2Terreno: number; m2Cubierto: number; precioTerreno: number; precioCubierto: number;
  transporte: number; servicios: number; seguridad: number; entorno: number; observaciones: string;
  min: number; rec: number; opt: number; valorM2: number;
  /** Valor de m² cubierto ya ajustado por antigüedad, y cuánto aporta cada componente al valor final (en USD, sin fórmulas). */
  precioCubiertoAjustado?: number; aporteCubierto?: number; aporteTerreno?: number;
  /** Imagen del mapa de ubicación, en base64 (data URL), si se pudo generar. */
  mapaDataUrl?: string | null;
  comparables?: Comparable[];
  /** Párrafo de fundamentación generado por IA (opcional). */
  informeIA?: string; informeEsFallback?: boolean; numero?: string;
};

const num = (v: number) => (v ? v.toLocaleString("es-AR") : "-");

/** Informe profesional de tasación: datos, valores de referencia, puntuación de entorno, resultado y firma. */
export async function construirTasacion(t: TasacionData) {
  const fecha = hoy();
  const numero = t.numero ?? `INF-${new Date().getFullYear()}-${String(Date.now() % 1000).padStart(3, "0")}`;
  const doc = await crearDoc("Informe de tasación", numero, fecha);

  const esTemporal = t.operacion === "alquiler_temporal";
  const opLabel = OPERACIONES.find((o) => o.value === t.operacion)!.label;
  const unidad = OPERACIONES.find((o) => o.value === t.operacion)!.unidad;
  const monto = (v: number) => `USD ${Math.round(v).toLocaleString("es-AR")}${unidad === "USD" ? "" : ` ${unidad.replace("USD/", "/")}`}`;

  let y = 54;
  y = seccion(doc, y, "Inmueble");
  const a = campo(doc, M, y, "Dirección", t.direccion || "Sin dirección", 170);
  y = a;
  const b1 = campo(doc, M, y, "Operación", opLabel, 42);
  const b2 = campo(doc, M + 44, y, "Tipo", t.tipo, 42);
  const b3 = campo(doc, M + 88, y, "Estado", t.estado, 42);
  const b4 = campo(doc, M + 131, y, "Zona", t.zona, 43);
  y = Math.max(b1, b2, b3, b4);
  const c1 = campo(doc, M, y, "Antigüedad", t.antiguedad ? `${t.antiguedad} años` : "-", 50);
  const c2 = esTemporal ? y : campo(doc, M + 58, y, "Superficie de terreno", t.m2Terreno ? `${num(t.m2Terreno)} m²` : "-", 50);
  const c3 = campo(doc, M + 116, y, "Superficie cubierta", t.m2Cubierto ? `${num(t.m2Cubierto)} m²` : "-", 56);
  y = Math.max(c1, c2, c3) + 2;

  // Mapa de ubicación (si se pudo generar; nunca bloquea el informe si falta)
  if (t.mapaDataUrl) {
    const altoMapa = 42;
    if (y + altoMapa + 10 > 262) { doc.addPage(); pie(doc); y = 22; }
    y = seccion(doc, y, "Ubicación");
    try {
      doc.addImage(t.mapaDataUrl, "PNG", M, y, ANCHO, altoMapa);
      draw(doc, C.linea); doc.setLineWidth(0.3); doc.roundedRect(M, y, ANCHO, altoMapa, 2, 2, "S");
      y += altoMapa + 6;
    } catch { /* imagen inválida: se sigue sin el mapa */ }
  }

  // Valores de referencia + entorno lado a lado
  const yTop = seccion(doc, y, "Valores de referencia");
  if (esTemporal) {
    campo(doc, M, yTop, "Tarifa de referencia", t.precioCubierto ? monto(t.precioCubierto) : "-", 60);
  } else {
    campo(doc, M, yTop, `USD / m² terreno`, t.precioTerreno ? `USD ${Math.round(t.precioTerreno).toLocaleString("es-AR")}` : "-", 60);
    campo(doc, M, yTop + 14, `USD / m² cubierto${unidad === "USD" ? "" : " (mes)"}`, t.precioCubierto ? `USD ${Math.round(t.precioCubierto).toLocaleString("es-AR")}` : "-", 60);
  }

  seccion(doc, y, "Puntuación de entorno", M + 96);
  const puntos: [string, number][] = [["Transporte", t.transporte], ["Servicios", t.servicios], ["Seguridad", t.seguridad], ["Entorno", t.entorno]];
  puntos.forEach(([n, v], i) => {
    const yy = y + 8 + i * 8;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); ink(doc, C.texto);
    doc.text(n, M + 96, yy);
    for (let k = 0; k < 5; k++) { fill(doc, k < v ? C.bronce : C.linea); doc.roundedRect(M + 122 + k * 7.5, yy - 3, 6, 3, 1.5, 1.5, "F"); }
    doc.setFont("helvetica", "bold"); ink(doc, C.bronce); doc.text(`${v}/5`, M + 163, yy);
  });
  y += 46;

  // Resultado
  y = seccion(doc, y, "Resultado de la tasación");
  const cajas: { l: string; v: number; sub: string; bg: readonly [number, number, number]; fg: readonly [number, number, number]; big?: boolean }[] = [
    { l: "Valor mínimo", v: t.min, sub: "-8%", bg: [251, 236, 239], fg: C.rojo },
    { l: "Valor recomendado", v: t.rec, sub: "precio sugerido de publicación", bg: C.dorado, fg: C.bronce, big: true },
    { l: "Valor óptimo", v: t.opt, sub: "+12%", bg: [234, 247, 240], fg: C.verde },
  ];
  const w = (ANCHO - 8) / 3;
  cajas.forEach((c, i) => {
    const x = M + i * (w + 4);
    fill(doc, c.bg); doc.roundedRect(x, y, w, c.big ? 30 : 30, 3, 3, "F");
    if (c.big) { draw(doc, C.bronce); doc.setLineWidth(0.6); doc.roundedRect(x, y, w, 30, 3, 3, "S"); }
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); ink(doc, c.fg);
    doc.text(c.l.toUpperCase(), x + w / 2, y + 8, { align: "center", charSpace: 0.4 });
    doc.setFontSize(c.big ? 14.5 : 12.5); doc.text(monto(c.v), x + w / 2, y + 17.5, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.text(c.sub, x + w / 2, y + 24, { align: "center" });
  });
  y += 38;
  // Cómo se compone el valor: los montos ya calculados, sin mostrar fórmulas ni porcentajes.
  if (!esTemporal && t.precioCubiertoAjustado) {
    const fila = (label: string, valor: string, indent = 0) => {
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); ink(doc, C.suave);
      doc.text(label, M + indent, y);
      doc.setFont("helvetica", "bold"); ink(doc, C.texto);
      doc.text(valor, M + 82, y);
      y += 5.8;
    };
    if (t.precioCubierto) fila("Valor de referencia (m² cubierto)", `USD ${Math.round(t.precioCubierto).toLocaleString("es-AR")}/m²`);
    fila("Ese valor, ajustado por la antigüedad", `USD ${Math.round(t.precioCubiertoAjustado).toLocaleString("es-AR")}/m²`);
    if (t.aporteCubierto) fila("Aporta a la tasación (construcción)", monto(t.aporteCubierto));
    if (t.aporteTerreno) fila("Aporta a la tasación (terreno)", monto(t.aporteTerreno));
    y += 3;
  }

  // Comparables relevados en portales (método comparativo)
  const comparables = (t.comparables ?? []).filter((c) => c.precio > 0);
  if (comparables.length) {
    y = seccion(doc, y, "Comparables relevados (método comparativo)");
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    for (const c of comparables) {
      if (y > 262) { doc.addPage(); pie(doc); y = 22; }
      ink(doc, C.texto);
      const precio = esTemporal ? monto(c.precio) : `USD ${Math.round(c.precio).toLocaleString("es-AR")}${c.m2 ? ` (${num(c.m2)} m²)` : ""}`;
      doc.text(`${c.portal} · ${c.direccion || "sin dirección"} · ${precio}`, M, y);
      y += 5.2;
    }
    y += 3;
  }

  // Párrafo de fundamentación (con salto de página si hace falta)
  const parrafo = (titulo: string, texto: string) => {
    y = seccion(doc, y, titulo);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); ink(doc, C.texto);
    const lineas = doc.splitTextToSize(texto, ANCHO) as string[];
    for (const ln of lineas) {
      if (y > 262) { doc.addPage(); pie(doc); y = 22; doc.setFont("helvetica", "normal"); doc.setFontSize(10); ink(doc, C.texto); }
      doc.text(ln, M, y); y += 4.8;
    }
    y += 4;
  };
  if (t.informeIA?.trim()) parrafo(`Fundamentación${t.informeEsFallback ? " (plantilla automática)" : ""}`, t.informeIA.trim());
  if (t.observaciones.trim()) parrafo("Observaciones del tasador", t.observaciones.trim());

  // Firma
  if (y > 245) { doc.addPage(); pie(doc); y = 30; }
  y = Math.max(y + 8, 246);
  draw(doc, C.texto); doc.setLineWidth(0.3); doc.line(210 - M - 70, y, 210 - M, y);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); ink(doc, C.texto);
  doc.text(BRAND.titular.nombre, 210 - M - 35, y + 5, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); ink(doc, C.suave);
  doc.text(`${BRAND.titular.rol} · ${BRAND.matricula}`, 210 - M - 35, y + 9.5, { align: "center" });
  doc.setFontSize(7); doc.text("Valuación orientativa basada en los valores de mercado informados y las condiciones del inmueble.", M, y + 18);
  return doc;
}

export async function descargarTasacion(t: TasacionData) {
  entregar(await construirTasacion(t), `Informe-Tasacion-${(t.direccion || "inmueble").replace(/[^\wáéíóúñ]+/gi, "-").slice(0, 30)}`);
}
