import type { Operacion, TipoPropiedad } from "@/lib/propiedades";

/** Páginas de búsqueda para Google: "casas en venta", "departamentos en alquiler", etc. */
const PLURAL: Record<TipoPropiedad, { plural: string; singular: string; genero: "f" | "m" }> = {
  casa: { plural: "Casas", singular: "casa", genero: "f" },
  departamento: { plural: "Departamentos", singular: "departamento", genero: "m" },
  ph: { plural: "PH", singular: "PH", genero: "m" },
  lote: { plural: "Lotes y terrenos", singular: "lote", genero: "m" },
  finca: { plural: "Fincas", singular: "finca", genero: "f" },
  local: { plural: "Locales comerciales", singular: "local comercial", genero: "m" },
  oficina: { plural: "Oficinas", singular: "oficina", genero: "f" },
};

export const COMBINACIONES: { slug: string; tipo: TipoPropiedad; operacion: Operacion }[] = (
  Object.keys(PLURAL) as TipoPropiedad[]
).flatMap((tipo) =>
  (["venta", "alquiler"] as Operacion[]).map((operacion) => ({
    slug: `${PLURAL[tipo].plural.split(" ")[0].toLowerCase()}-en-${operacion}`,
    tipo, operacion,
  }))
);

export const combinacionDesdeSlug = (slug: string) => COMBINACIONES.find((c) => c.slug === slug);
export const rutaSeo = (tipo: TipoPropiedad, operacion: Operacion) =>
  `/propiedades/${COMBINACIONES.find((c) => c.tipo === tipo && c.operacion === operacion)!.slug}`;

export function textosSeo(tipo: TipoPropiedad, operacion: Operacion) {
  const t = PLURAL[tipo];
  const accion = operacion === "venta" ? "en venta" : "en alquiler";
  return {
    titulo: `${t.plural} ${accion} en San Martín, Mendoza`,
    h1: `${t.plural} ${accion}`,
    descripcion: `${t.plural} ${accion} en San Martín y toda Mendoza. Fotos, precios y datos reales, con la atención personalizada de MG Real Estate.`,
    intro: operacion === "venta"
      ? `Encontrá ${t.plural.toLowerCase()} en venta en San Martín y la zona Este de Mendoza. Todas las propiedades son revisadas por nuestro equipo y publicadas con fotos y datos reales, para que compres con confianza.`
      : `Encontrá ${t.plural.toLowerCase()} en alquiler en San Martín y la zona Este de Mendoza. Te acompañamos en todo el proceso: visita, contrato y entrega de llaves.`,
  };
}

/* ------------------------------ Páginas por zona ------------------------------ */
const sinAcentos = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");
export const slugZona = (z: string) => sinAcentos(z).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
/** "san martin" → "San Martin" (los nombres vienen tal cual se cargaron en el panel). */
export const tituloZona = (z: string) => z.trim().toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

/** Zonas (barrio o ciudad) que tienen al menos una propiedad publicada. */
const limpiarZona = (z: string) => z.replace(/,\s*mendoza$/i, "").trim();
export function zonasDe(propiedades: { ubicacion: string }[]) {
  const mapa = new Map<string, string>();
  for (const p of propiedades) {
    for (const parte of p.ubicacion.split(" · ").map(limpiarZona).filter(Boolean)) {
      if (parte.toLowerCase() === "mendoza") continue; // valor por defecto cuando no hay barrio ni ciudad
      const slug = slugZona(parte);
      if (slug && !mapa.has(slug)) mapa.set(slug, tituloZona(parte));
    }
  }
  return [...mapa].map(([slug, nombre]) => ({ slug, nombre }));
}
export const propiedadesDeZona = <T extends { ubicacion: string }>(propiedades: T[], slug: string) =>
  propiedades.filter((p) => p.ubicacion.split(" · ").some((x) => slugZona(limpiarZona(x)) === slug));
