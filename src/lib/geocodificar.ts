/**
 * Ubica una zona (barrio + ciudad) en el mapa con OpenStreetMap Nominatim (gratis, sin clave).
 * Se usa solo la ZONA, no la dirección exacta: el mapa público muestra ubicación aproximada.
 * Pensado para llamarse desde el navegador del panel, una consulta a la vez (límite del servicio: 1 por segundo).
 */
export async function geocodificarZona(barrio: string | null, ciudad: string | null): Promise<{ lat: number; lng: number } | null> {
  const zona = [barrio, ciudad || "San Martín", "Mendoza", "Argentina"].filter(Boolean).join(", ");
  const probar = async (q: string) => {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ar&q=${encodeURIComponent(q)}`, { headers: { Accept: "application/json" } });
      if (!r.ok) return null;
      const d = (await r.json()) as { lat: string; lon: string }[];
      const lat = parseFloat(d[0]?.lat), lng = parseFloat(d[0]?.lon);
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    } catch { return null; }
  };
  const exacta = await probar(zona);
  if (exacta || !barrio) return exacta;
  await new Promise((ok) => setTimeout(ok, 1100)); // respetar el límite de 1 consulta por segundo
  return probar([ciudad || "San Martín", "Mendoza", "Argentina"].join(", ")); // si el barrio no se encuentra, centro de la ciudad
}
