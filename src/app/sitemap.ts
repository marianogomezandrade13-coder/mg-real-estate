import type { MetadataRoute } from "next";
import { rutaPropiedad } from "@/lib/propiedades";
import { listarPublicadas } from "@/lib/propiedades-db";
import { COMBINACIONES, zonasDe } from "@/lib/seo-paginas";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mgrealestate.vercel.app";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const propiedades = await listarPublicadas();
  return [
    { url: `${BASE}/`, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/catalogo`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/contacto`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/preguntas-frecuentes`, changeFrequency: "monthly", priority: 0.5 },
    // Páginas de búsqueda ("casas en venta"…): solo las que tienen propiedades publicadas
    ...COMBINACIONES.filter((c) => propiedades.some((p) => p.tipo === c.tipo && p.operacion === c.operacion)).map((c) => ({
      url: `${BASE}/propiedades/${c.slug}`, changeFrequency: "daily" as const, priority: 0.8,
    })),
    ...zonasDe(propiedades).map((z) => ({ url: `${BASE}/zona/${z.slug}`, changeFrequency: "daily" as const, priority: 0.7 })),
    ...propiedades.map((p) => ({
      url: `${BASE}${rutaPropiedad(p.codigo)}`,
      lastModified: p.publicada,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
