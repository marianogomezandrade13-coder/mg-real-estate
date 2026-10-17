"use server";

import { requireStaff } from "@/lib/auth";

export type EntradaPublicacionIA = {
  tipo: string; operacion: string; precio: number; moneda: string; direccion: string | null; barrio: string | null; ciudad: string | null;
  ambientes: number | null; dormitorios: number | null; banos: number | null; cocheras: number | null;
  m2Cubiertos: number | null; m2Totales: number | null; antiguedad: number | null; amenities: string[]; descripcion: string | null;
};

export type ResultadoPublicacionIA = { titulo: string; descripcion: string };

const SYSTEM = `Sos un redactor inmobiliario que escribe avisos para portales como ZonaProp y Argenprop, para MG Real Estate en San Martín, Mendoza, Argentina.
Recibís los datos reales de una propiedad. Son un DATO DE ENTRADA: no inventes amenities, ubicaciones ni características que no te dieron. Si un dato falta, simplemente no lo menciones.
Generá:
1) Un título SEO de hasta 70 caracteres: tipo de propiedad, ambientes o dormitorios si los tenés, y la zona si la tenés.
2) Una descripción de venta o alquiler de 80 a 150 palabras, en español rioplatense, cálida pero profesional, que mencione solo los datos reales (tipo, ambientes, m², estado, amenities, zona, operación). Sin inventar.
Respondé ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después, sin bloque de código, con este formato exacto:
{"titulo": string, "descripcion": string}`;

/** Genera título y descripción para portales a partir de los datos reales de la propiedad. Solo staff. */
export async function generarPublicacionIA(input: EntradaPublicacionIA): Promise<{ ok: true; data: ResultadoPublicacionIA } | { ok: false; error: string }> {
  await requireStaff();

  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, error: "Falta configurar la clave de IA (GEMINI_API_KEY) en el servidor." };

  const mensaje = JSON.stringify({
    tipo: input.tipo, operacion: input.operacion, precio: input.precio, moneda: input.moneda,
    direccion: input.direccion, barrio: input.barrio, ciudad: input.ciudad,
    ambientes: input.ambientes, dormitorios: input.dormitorios, banos: input.banos, cocheras: input.cocheras,
    m2_cubiertos: input.m2Cubiertos, m2_totales: input.m2Totales, antiguedad_anios: input.antiguedad,
    amenities: input.amenities, descripcion_actual: input.descripcion || null,
  });

  const preferido = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const modelos = [preferido, ...(["gemini-3.5-flash", "gemini-flash-latest"].filter((m) => m !== preferido))];

  const llamar = async (modelo: string) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: `Datos de la propiedad:\n${mensaje}` }] }],
      generationConfig: { maxOutputTokens: 1200, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });

  let ultimoError = "No se pudo generar el contenido. Probá de nuevo.";
  for (const modelo of modelos) {
    try {
      const res = await llamar(modelo);
      if (!res.ok) {
        if (res.status === 400 || res.status === 403) return { ok: false, error: "La clave de IA no es válida." };
        if (res.status === 503 || res.status === 429) { ultimoError = "El servicio de IA está saturado en este momento. Probá de nuevo en unos segundos."; continue; }
        const detalle = await res.text().catch(() => "");
        ultimoError = `El servicio de IA respondió con error (${res.status}). ${detalle.slice(0, 140)}`;
        continue;
      }
      const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const texto = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
      const limpio = texto.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      const parsed = JSON.parse(limpio) as { titulo: string; descripcion: string };
      if (!parsed.titulo || !parsed.descripcion) throw new Error("respuesta incompleta");
      return { ok: true, data: { titulo: parsed.titulo.trim(), descripcion: parsed.descripcion.trim() } };
    } catch {
      ultimoError = "No se pudo interpretar la respuesta de la IA. Probá de nuevo.";
    }
  }
  return { ok: false, error: ultimoError };
}
