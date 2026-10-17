"use server";

import { requireStaff } from "@/lib/auth";

import { calcularValuacion, OPERACIONES, type Comparable, type EntradaValuacion, type Valuacion } from "@/lib/tasacion-calculo";

export type EntradaTasacionIA = EntradaValuacion & {
  direccion: string; tipo: string; estado: string; zona: string; observaciones: string;
};

export type ResultadoTasacionIA = Valuacion & { informe: string; esFallback?: boolean };

const SYSTEM = `Sos un tasador inmobiliario que redacta la fundamentación de informes de tasación para MG Real Estate, una inmobiliaria de San Martín, Mendoza, Argentina, que trabaja con el MÉTODO COMPARATIVO DE MERCADO.
Te paso los datos del inmueble y un valor final YA CALCULADO por el sistema (mínimo, recomendado, óptimo): es matemática, no la hizo la IA, así que NO la recalcules, no la cuestiones y no des otros números. Tu única tarea es escribir el párrafo de fundamentación.
Si te paso comparables_relevados (publicaciones similares que el tasador relevó en portales como ZonaProp, MendozaProp o Argenprop), el párrafo debe apoyarse fuerte en ellas: mencioná cuántas se relevaron, en qué portales, y cómo su promedio y el valor de referencia del tasador sustentan el número final. Si no hay comparables, fundamentá con la superficie, el estado de conservación, la zona, la antigüedad y la puntuación de entorno, y sugerí (sin ser tajante) que cargar publicaciones comparables de portales fortalecería el informe.
Escribí en español rioplatense, 130 a 190 palabras, tono profesional. Incorporá el valor recomendado y su unidad (USD, USD/mes o USD/noche según la operación) de forma natural en el texto, sin listarlo como viñetas. No inventes comparables, portales ni cifras que no te hayan dado.
Respondé ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después, sin bloque de código, con este formato exacto:
{"informe": string}`;

const fmtMonto = (v: number, unidad: string) => `USD ${Math.round(v).toLocaleString("es-AR")}${unidad === "USD" ? "" : ` ${unidad.replace("USD/", "/")}`}`;

/**
 * Párrafo de fundamentación sin IA, armado con una plantilla fija en español. Se usa SOLO si Gemini no
 * respondió después de reintentar con los modelos alternativos (caído, saturado, sin clave configurada):
 * la valuación ya está calculada con matemática propia (calcularValuacion), así que no hace falta bloquear
 * la tasación entera por una falla de un servicio externo — el tasador siempre puede terminar su trabajo.
 */
function redactarFundamentacionSinIA(input: EntradaTasacionIA, v: Valuacion): string {
  const partes: string[] = [];
  partes.push(
    `Esta tasación se realizó por el método comparativo de mercado, combinando el valor de referencia cargado por ` +
    `el tasador con los comparables relevados en portales inmobiliarios.`
  );
  const esTemporal = input.operacion === "alquiler_temporal";
  if (v.comparablesValidos > 0 && v.promedioComparables !== null) {
    const portales = [...new Set(input.comparables.filter((c) => c.precio > 0).map((c) => c.portal))];
    const promedioTxt = esTemporal ? fmtMonto(v.promedioComparables, v.unidad) : `${fmtMonto(v.promedioComparables, "USD")}/m²`;
    partes.push(
      `Se relevaron ${v.comparablesValidos} ${v.comparablesValidos > 1 ? "publicaciones comparables" : "publicación comparable"} ` +
      `${portales.length ? `en ${portales.join(", ")} ` : ""}con un promedio de ${promedioTxt}.`
    );
  } else {
    partes.push(`No se cargaron comparables de mercado; el valor se basó en la referencia propia del tasador y las características del inmueble.`);
  }
  partes.push(
    `El inmueble (${input.tipo.toLowerCase()}, estado ${input.estado.toLowerCase()}, zona ${input.zona}` +
    `${input.antiguedad ? `, ${input.antiguedad} años de antigüedad` : ""}) tiene una puntuación de entorno de ` +
    `${((input.transporte + input.servicios + input.seguridad + input.entorno) / 4).toFixed(1)}/5.`
  );
  partes.push(`En base a estos datos, el valor recomendado es de ${fmtMonto(v.rec, v.unidad)}, con un rango entre ${fmtMonto(v.min, v.unidad)} y ${fmtMonto(v.opt, v.unidad)}.`);
  partes.push(`Nota: este párrafo se generó automáticamente con una plantilla (el servicio de redacción con IA no respondió); los valores numéricos son los mismos que hubiera usado la IA, ya que se calculan aparte.`);
  return partes.join(" ");
}

function validar(input: EntradaTasacionIA): string | null {
  if (!input.direccion.trim()) return "Ingresá la dirección del inmueble.";
  const esTemporal = input.operacion === "alquiler_temporal";
  if (!esTemporal && !(input.m2Terreno > 0 || input.m2Cubierto > 0)) return "Ingresá al menos una superficie.";
  const hayReferencia = input.precioTerreno > 0 || input.precioCubierto > 0;
  const hayComparables = input.comparables.some((c) => c.precio > 0);
  if (!hayReferencia && !hayComparables) return "Ingresá un valor de referencia o al menos un comparable con precio.";
  return null;
}

/**
 * Calcula la valuación (determinística, ver tasacion-calculo.ts) y le pide a la IA solo el párrafo de
 * fundamentación, apoyado en los comparables de mercado relevados. Requiere GEMINI_API_KEY (gratis en
 * aistudio.google.com/apikey); el modelo se puede cambiar con GEMINI_MODEL sin tocar código.
 */
export async function generarTasacionIA(input: EntradaTasacionIA): Promise<{ ok: true; data: ResultadoTasacionIA } | { ok: false; error: string }> {
  await requireStaff();

  const errorValidacion = validar(input);
  if (errorValidacion) return { ok: false, error: errorValidacion };

  const valuacion = calcularValuacion(input);
  if (!(valuacion.rec > 0)) return { ok: false, error: "No se pudo calcular un valor con esos datos: revisá las superficies y los precios de referencia." };

  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: true, data: { ...valuacion, informe: redactarFundamentacionSinIA(input, valuacion), esFallback: true } };

  const comparablesValidos: Comparable[] = input.comparables.filter((c) => c.precio > 0);
  const mensaje = JSON.stringify({
    operacion: OPERACIONES.find((o) => o.value === input.operacion)!.label, direccion: input.direccion, tipo: input.tipo,
    estado_conservacion: input.estado, zona: input.zona, antiguedad_anios: input.antiguedad,
    m2_terreno: input.m2Terreno, m2_cubierto: input.m2Cubierto,
    puntuacion_entorno_1_a_5: { transporte: input.transporte, servicios: input.servicios, seguridad: input.seguridad, entorno_general: input.entorno },
    comparables_relevados: comparablesValidos.map((c) => ({ portal: c.portal, direccion: c.direccion, precio: c.precio, m2: c.m2 })),
    promedio_comparables: valuacion.promedioComparables, unidad: valuacion.unidad,
    valor_ya_calculado: { minimo: valuacion.min, recomendado: valuacion.rec, optimo: valuacion.opt },
    observaciones_del_tasador: input.observaciones || null,
  });

  const preferido = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const modelos = [preferido, ...(["gemini-3.5-flash", "gemini-flash-latest"].filter((m) => m !== preferido))];

  const llamar = async (modelo: string) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: `Datos del inmueble y valor ya calculado:\n${mensaje}` }] }],
      generationConfig: { maxOutputTokens: 1400, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });

  let ultimoError = "No se pudo generar la fundamentación. Probá de nuevo.";
  for (const modelo of modelos) {
    try {
      const res = await llamar(modelo);
      if (!res.ok) {
        // Clave inválida: no tiene sentido reintentar con otro modelo, pero igual se entrega la tasación
        // con la fundamentación de respaldo (abajo) en vez de dejar al tasador sin poder terminar el informe.
        if (res.status === 400 || res.status === 403) { ultimoError = "La clave de IA no es válida."; break; }
        if (res.status === 503 || res.status === 429) { ultimoError = "El servicio de IA está saturado en este momento. Probá de nuevo en unos segundos."; continue; }
        const detalle = await res.text().catch(() => "");
        ultimoError = `El servicio de IA respondió con error (${res.status}). ${detalle.slice(0, 140)}`;
        continue;
      }
      const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[] };
      const texto = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
      const limpio = texto.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      const parsed = JSON.parse(limpio) as { informe: string };
      if (!parsed.informe?.trim()) throw new Error("respuesta incompleta");
      // Gemini, muy de vez en cuando, devuelve el texto con los acentos codificados mal ("SaÃ­n" en vez de
      // "San"): es una rareza del modelo, no un bug del código (se confirmó reproduciendo el mismo pedido
      // dos veces: una salió mal, la otra perfecta). Un informe de tasación con acentos rotos se ve poco
      // profesional, así que si se detecta se descarta como si hubiera fallado y se reintenta con otro modelo.
      if (/[ÃÂ][\u0080-¿]/.test(parsed.informe)) throw new Error("texto con codificación corrupta");
      return { ok: true, data: { ...valuacion, informe: parsed.informe.trim() } };
    } catch {
      ultimoError = "No se pudo interpretar la respuesta de la IA. Probá de nuevo.";
    }
  }
  // La IA no respondió después de reintentar con los modelos alternativos: la valuación ya está calculada
  // (matemática propia, no depende de la IA), así que se entrega igual con una fundamentación de respaldo
  // en vez de dejar al tasador sin poder terminar el informe por una falla de un servicio externo.
  console.error("[tasaciones] IA no disponible, se usó fundamentación de respaldo:", ultimoError);
  return { ok: true, data: { ...valuacion, informe: redactarFundamentacionSinIA(input, valuacion), esFallback: true } };
}
