"use server";

import { requireStaff } from "@/lib/auth";
import { BRAND } from "@/lib/brand";

export type EntradaPostRedes = {
  tipo: string; operacion: string; precio: number; moneda: string; direccion: string | null; barrio: string | null; ciudad: string | null;
  ambientes: number | null; dormitorios: number | null; banos: number | null; cocheras: number | null;
  m2Cubiertos: number | null; m2Totales: number | null; antiguedad: number | null; amenities: string[];
};

export type ResultadoPostRedes = { caption: string; hashtags: string[] };
export type ResultadoIdeaContenido = { idea: string; caption: string };

const llamarGemini = async (system: string, mensaje: string, maxTokens: number) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false as const, error: "Falta configurar la clave de IA (GEMINI_API_KEY) en el servidor." };

  const preferido = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const modelos = [preferido, ...(["gemini-3.5-flash", "gemini-flash-latest"].filter((m) => m !== preferido))];
  const llamar = (modelo: string) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: mensaje }] }],
      generationConfig: { maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });

  let ultimoError = "No se pudo generar el contenido. Probá de nuevo.";
  for (const modelo of modelos) {
    try {
      const res = await llamar(modelo);
      if (!res.ok) {
        if (res.status === 400 || res.status === 403) return { ok: false as const, error: "La clave de IA no es válida." };
        if (res.status === 503 || res.status === 429) { ultimoError = "El servicio de IA está saturado en este momento. Probá de nuevo en unos segundos."; continue; }
        continue;
      }
      const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const texto = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
      const limpio = texto.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      // Se descarta una respuesta con acentos codificados mal (rareza rara de Gemini, ya vista en Tasaciones) y se reintenta.
      if (/[ÃÂ][\u0080-¿]/.test(limpio)) { ultimoError = "La IA devolvió texto con codificación corrupta."; continue; }
      return { ok: true as const, texto: limpio };
    } catch {
      ultimoError = "No se pudo interpretar la respuesta de la IA. Probá de nuevo.";
    }
  }
  return { ok: false as const, error: ultimoError };
};

const SYSTEM_POST = `Sos quien maneja las redes sociales (Instagram/Facebook) de MG Real Estate, una inmobiliaria de San Martín, Mendoza, Argentina.
Recibís los datos reales de una propiedad — son un DATO DE ENTRADA, no inventes amenities, ubicación ni características que no te dieron; si falta un dato, no lo menciones.
Escribí un posteo corto y atractivo para redes (NO es el mismo estilo que un aviso de portal): frases cortas, algún emoji con moderación (sin abusar), que dé ganas de consultar. Terminá con una llamada a la acción para escribir por WhatsApp o DM.
Después armá una lista de 8 a 12 hashtags relevantes en español, mezclando generales (#Inmobiliaria #Mendoza) con específicos de la zona/tipo de propiedad, sin espacios raros ni inventar zonas que no te dieron.
Respondé ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después, sin bloque de código: {"caption": string, "hashtags": string[]}`;

/** Genera un posteo para redes (distinto del aviso de portal) a partir de los datos reales de una propiedad. */
export async function generarPostRedesIA(input: EntradaPostRedes): Promise<{ ok: true; data: ResultadoPostRedes } | { ok: false; error: string }> {
  await requireStaff();
  const mensaje = JSON.stringify({
    tipo: input.tipo, operacion: input.operacion, precio: input.precio, moneda: input.moneda,
    direccion: input.direccion, barrio: input.barrio, ciudad: input.ciudad,
    ambientes: input.ambientes, dormitorios: input.dormitorios, banos: input.banos, cocheras: input.cocheras,
    m2_cubiertos: input.m2Cubiertos, m2_totales: input.m2Totales, antiguedad_anios: input.antiguedad, amenities: input.amenities,
  });
  const r = await llamarGemini(SYSTEM_POST, `Datos de la propiedad:\n${mensaje}`, 900);
  if (!r.ok) return r;
  try {
    const parsed = JSON.parse(r.texto) as { caption: string; hashtags: string[] };
    if (!parsed.caption || !Array.isArray(parsed.hashtags)) throw new Error("respuesta incompleta");
    return { ok: true, data: { caption: parsed.caption.trim(), hashtags: parsed.hashtags.filter(Boolean) } };
  } catch {
    return { ok: false, error: "No se pudo interpretar la respuesta de la IA. Probá de nuevo." };
  }
}

const SYSTEM_IDEA = `Sos quien maneja las redes sociales de MG Real Estate, inmobiliaria de San Martín, Mendoza, Argentina (matrícula en trámite, titular Mariano Gómez).
Es un día sin propiedad nueva para publicar y necesitás una idea de contenido genérica para mantener activas las redes. Puede ser: un tip para quien vende/alquila/compra, una aclaración sobre el mercado local, una pregunta para generar interacción, una curiosidad del rubro inmobiliario en Mendoza, o un recordatorio de los servicios de la inmobiliaria (tasaciones, alquileres, venta, asesoramiento).
NO inventes datos concretos del mercado (porcentajes, cifras de venta, estadísticas) que no te dieron — si querés mencionar una tendencia, hacelo en términos generales ("en San Martín crece la demanda de..." está bien si es una afirmación razonable y genérica; una cifra específica inventada, no).
Devolvé: 1) una idea breve (una frase, para que el equipo entienda de qué se trata sin leer todo) y 2) el texto del posteo ya redactado, listo para publicar, con el mismo tono cálido y profesional de la marca.
Respondé ÚNICAMENTE con un objeto JSON válido: {"idea": string, "caption": string}`;

/** Idea de contenido genérica (sin propiedad puntual) para publicar en un día sin novedades. */
export async function generarIdeaContenidoIA(): Promise<{ ok: true; data: ResultadoIdeaContenido } | { ok: false; error: string }> {
  await requireStaff();
  const r = await llamarGemini(SYSTEM_IDEA, `Generá una idea de contenido para hoy (${new Date().toLocaleDateString("es-AR")}) para ${BRAND.name}, ${BRAND.city}.`, 700);
  if (!r.ok) return r;
  try {
    const parsed = JSON.parse(r.texto) as { idea: string; caption: string };
    if (!parsed.idea || !parsed.caption) throw new Error("respuesta incompleta");
    return { ok: true, data: { idea: parsed.idea.trim(), caption: parsed.caption.trim() } };
  } catch {
    return { ok: false, error: "No se pudo interpretar la respuesta de la IA. Probá de nuevo." };
  }
}
