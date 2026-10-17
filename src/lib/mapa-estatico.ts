"use server";

import { requireStaff } from "@/lib/auth";

/**
 * Imagen fija del mapa (para meter en un PDF; el mapa navegable del sitio/portal usa un iframe de Google
 * Maps que no sirve acá porque un PDF necesita una imagen, no una página embebida). Usa Geoapify porque
 * tiene nivel gratuito real sin tarjeta (3000 mapas/día) — mismo criterio que se usó para elegir Gemini en
 * vez de la API paga de Anthropic. Se geocodifica la dirección (texto → lat/lon) y con eso se pide el mapa.
 * Requiere GEOAPIFY_API_KEY (gratis en myprojects.geoapify.com). Si no está configurada o algo falla,
 * devuelve null: la tasación se genera igual, solo sin el mapa (nunca bloquea el informe por esto).
 */
export async function obtenerImagenMapa(direccion: string): Promise<string | null> {
  await requireStaff();
  const key = process.env.GEOAPIFY_API_KEY;
  if (!key || !direccion.trim()) return null;

  try {
    const geo = await fetch(
      `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(direccion)}&filter=countrycode:ar&limit=1&apiKey=${key}`
    );
    if (!geo.ok) return null;
    const geoJson = (await geo.json()) as { features?: { geometry?: { coordinates?: [number, number] } }[] };
    const coords = geoJson.features?.[0]?.geometry?.coordinates;
    if (!coords) return null;
    const [lon, lat] = coords;

    const mapa = await fetch(
      `https://maps.geoapify.com/v1/staticmap?style=osm-bright&width=700&height=380&center=lonlat:${lon},${lat}&zoom=16` +
      `&marker=lonlat:${lon},${lat};color:%238a6529;size:large&apiKey=${key}`
    );
    if (!mapa.ok) return null;
    const buf = Buffer.from(await mapa.arrayBuffer());
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null; // sin conexión, geocodificación sin resultado, etc.: la tasación sigue sin el mapa
  }
}
