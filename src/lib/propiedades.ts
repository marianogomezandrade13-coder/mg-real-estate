/**
 * Tipos y utilidades de las propiedades PÚBLICAS del sitio (aptas para cliente y servidor).
 * Los datos salen de Supabase (ver `propiedades-db.ts`): acá no hay datos de ejemplo.
 */
export type TipoPropiedad = "casa" | "departamento" | "finca" | "lote" | "ph" | "local" | "oficina";
export type Operacion = "venta" | "alquiler";

export type Propiedad = {
  codigo: string;
  titulo: string;
  operacion: Operacion;
  tipo: TipoPropiedad;
  precio: string;
  precioNum: number;
  moneda: "USD" | "ARS";
  /** Ubicación corta para tarjetas */
  ubicacion: string;
  /** Dirección completa (ficha y mapa) */
  direccion: string;
  descripcion: string;
  ambientes: number;
  dormitorios: number;
  banos: number;
  cocheras: number;
  m2Cubiertos: number;
  m2Totales: number;
  antiguedad: number | null;
  expensas?: string;
  amenities: string[];
  /** Foto principal (URL pública) */
  foto?: string;
  /** Todas las fotos, en orden (la primera es la principal) */
  fotos: string[];
  /** Gradiente Tailwind del placeholder cuando no hay foto */
  tono: string;
  /** Fecha de carga ISO, para "Más reciente" */
  publicada: string;
};

/** Valor de la columna `tipo` de la base → tipo del sitio */
export const TIPO_DESDE_DB: Record<string, TipoPropiedad> = {
  Casa: "casa", Departamento: "departamento", PH: "ph", Finca: "finca", Oficina: "oficina", Local: "local", Lote: "lote",
};

export const TIPOS_FILTRO: { v: "" | TipoPropiedad; l: string }[] = [
  { v: "", l: "Todos" }, { v: "casa", l: "Casa" }, { v: "departamento", l: "Departamento" }, { v: "ph", l: "PH" },
  { v: "lote", l: "Lote" }, { v: "finca", l: "Finca" }, { v: "local", l: "Local" }, { v: "oficina", l: "Oficina" },
];

const TONOS = [
  "from-[#C9A66B] via-[#A9834A] to-[#6E4F1F]", "from-[#7E8B62] via-[#56664A] to-[#283932]",
  "from-[#8A9A6B] via-[#5D7050] to-[#1F2C26]", "from-[#D8C7A3] via-[#B7A57F] to-[#7C6B45]",
  "from-[#A8956B] via-[#8A7548] to-[#453A22]", "from-[#C7B98F] via-[#9C8B5E] to-[#4F4630]",
];
/** Tono estable por propiedad (mismo código → mismo color) */
export const tonoPara = (codigo: string) => TONOS[[...codigo].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % TONOS.length];

/** "USD 145.000" · "$ 480.000/mes" */
export function formatPrecio(precio: number, moneda: "USD" | "ARS", operacion: Operacion) {
  if (!precio) return "Consultar";
  const v = Math.round(precio).toLocaleString("es-AR");
  return `${moneda === "USD" ? "USD" : "$"} ${v}${operacion === "alquiler" ? "/mes" : ""}`;
}

/** m² que mejor describe la propiedad en una tarjeta: terreno para lotes/fincas, cubiertos para el resto. */
export const m2Tarjeta = (p: Propiedad) => (p.tipo === "lote" || p.tipo === "finca" ? p.m2Totales : p.m2Cubiertos) || p.m2Totales || p.m2Cubiertos;

/** Propiedades afines: misma operación y tipo primero, luego misma operación. */
export function similares(p: Propiedad, todas: Propiedad[], n = 3) {
  const score = (o: Propiedad) => (o.operacion === p.operacion ? 2 : 0) + (o.tipo === p.tipo ? 1 : 0);
  return todas.filter((o) => o.codigo !== p.codigo).sort((a, b) => score(b) - score(a)).slice(0, n);
}

/** Mapa embebido sin API key. */
export const mapaEmbedUrl = (direccion: string) =>
  `https://maps.google.com/maps?q=${encodeURIComponent(direccion)}&output=embed`;

/** "Soldado independencia" → "SOLDADO-INDEPENDENCIA" (sin acentos, solo letras, números y guiones). */
export const normalizarCodigo = (texto: string) =>
  texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Ruta pública de la ficha. Los códigos los escribe el equipo y pueden tener espacios o acentos. */
export const rutaPropiedad = (codigo: string) => `/propiedad/${encodeURIComponent(codigo)}`;

/** El parámetro de la URL puede llegar codificado ("Solado%20independencia"). */
export function codigoDesdeRuta(param: string) {
  try { return decodeURIComponent(param); } catch { return param; }
}
