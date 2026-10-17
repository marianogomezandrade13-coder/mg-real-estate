import type { MetadataRoute } from "next";
import { listarPublicadas } from "@/lib/propiedades-db";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mgrealestate.vercel.app";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const propiedades = await listarPublicadas();
  return [
    { url: `${BASE}/`, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/catalogo`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/contacto`, changeFrequency: "monthly", priority: 0.6 },
    ...propiedades.map((p) => ({
      url: `${BASE}/propiedad/${p.codigo}`,
      lastModified: p.publicada,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
