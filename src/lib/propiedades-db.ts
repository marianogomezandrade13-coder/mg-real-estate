import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { TIPO_DESDE_DB, formatPrecio, tonoPara, type Propiedad } from "./propiedades";

type Fila = Database["public"]["Tables"]["propiedades"]["Row"];

/** Cliente anónimo (sin cookies): así las páginas públicas se pueden cachear. RLS solo entrega lo publicado. */
const publico = () =>
  createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

/** Desplazamiento estable (≈ hasta 400 m) según el código: evita que varios pines de la misma zona se tapen y no revela la dirección. */
function coordsAprox(f: Fila) {
  if (f.lat == null || f.lng == null) return undefined;
  const h = [...f.codigo].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 11);
  const dx = (((h % 1000) / 1000) - 0.5) * 0.008, dy = ((((h >>> 10) % 1000) / 1000) - 0.5) * 0.008;
  return { lat: f.lat + dy, lng: f.lng + dx };
}

function aPropiedad(f: Fila, fotos: string[]): Propiedad {
  const serv = (f.servicios ?? {}) as { amenities?: unknown };
  const extras = Array.isArray(serv.amenities) ? serv.amenities.filter((x): x is string => typeof x === "string") : [];
  const amenities = f.patio && !extras.includes("Patio") ? ["Patio", ...extras] : extras;
  const operacion = f.operacion === "Alquiler" ? "alquiler" : "venta";
  const partes = [f.barrio, f.ciudad].filter(Boolean);
  return {
    codigo: f.codigo,
    titulo: f.titulo,
    operacion,
    tipo: TIPO_DESDE_DB[f.tipo] ?? "casa",
    precio: formatPrecio(f.precio, f.moneda, operacion),
    precioNum: f.precio,
    moneda: f.moneda,
    ubicacion: partes.join(" · ") || "Mendoza",
    direccion: [f.direccion, f.barrio, f.ciudad, f.provincia].filter(Boolean).join(", ") || "Mendoza, Argentina",
    descripcion: f.descripcion ?? "",
    ambientes: f.ambientes ?? 0,
    dormitorios: f.dormitorios ?? 0,
    banos: f.banos ?? 0,
    cocheras: f.cocheras ?? 0,
    m2Cubiertos: f.m2_cubiertos ?? 0,
    m2Totales: f.m2_totales ?? 0,
    antiguedad: f.antiguedad,
    expensas: f.expensas ? `$ ${Math.round(f.expensas).toLocaleString("es-AR")}/mes` : undefined,
    amenities,
    foto: fotos[0],
    fotos,
    tono: tonoPara(f.codigo),
    publicada: f.created_at,
    coords: coordsAprox(f),
  };
}

/** Propiedades visibles en el sitio: publicadas y activas, de la más nueva a la más vieja. */
export async function listarPublicadas(): Promise<Propiedad[]> {
  try {
    const db = publico();
    const { data, error } = await db
      .from("propiedades").select("*")
      .eq("publicada_web", true).eq("estado", "Activa")
      .order("created_at", { ascending: false });
    if (error || !data) { console.error("listarPublicadas:", error?.message); return []; }
    if (data.length === 0) return [];

    const { data: medios } = await db
      .from("propiedad_medios").select("propiedad_id,url,orden")
      .in("propiedad_id", data.map((d) => d.id)).eq("tipo", "foto").order("orden", { ascending: true });
    const porProp = new Map<string, string[]>();
    for (const m of medios ?? []) porProp.set(m.propiedad_id, [...(porProp.get(m.propiedad_id) ?? []), m.url]);

    return data.map((f) => aPropiedad(f, porProp.get(f.id) ?? []));
  } catch (e) {
    console.error("listarPublicadas falló:", (e as Error).message);
    return [];
  }
}

export async function obtenerPublicada(codigo: string): Promise<Propiedad | undefined> {
  return (await listarPublicadas()).find((p) => p.codigo === codigo);
}
