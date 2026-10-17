/**
 * Cálculo de la valuación por MÉTODO COMPARATIVO DE MERCADO. Es matemática determinística (no la hace la IA,
 * para que nunca invente ni se equivoque un número): mezcla el valor de referencia que carga el tasador con
 * el promedio de los comparables reales que relevó en portales (ZonaProp, MendozaProp, Argenprop), y aplica
 * los ajustes por antigüedad y por puntuación de entorno. La IA (ver ia-tasacion.ts) solo redacta el párrafo
 * de fundamentación a partir de estos números ya calculados.
 */

export type Operacion = "venta" | "alquiler" | "alquiler_temporal";

export const OPERACIONES: { value: Operacion; label: string; unidad: string }[] = [
  { value: "venta", label: "Venta", unidad: "USD" },
  { value: "alquiler", label: "Alquiler", unidad: "USD/mes" },
  { value: "alquiler_temporal", label: "Alquiler temporal", unidad: "USD/noche" },
];

export type Comparable = { portal: string; direccion: string; precio: number; m2: number | null; link: string };

export type EntradaValuacion = {
  operacion: Operacion;
  m2Terreno: number; m2Cubierto: number; precioTerreno: number; precioCubierto: number;
  antiguedad: number; transporte: number; servicios: number; seguridad: number; entorno: number;
  comparables: Comparable[];
};

export type Valuacion = {
  min: number; rec: number; opt: number;
  promedioComparables: number | null;
  comparablesValidos: number;
  ajusteAntiguedad: number; // %, siempre <= 0
  ajusteEntorno: number; // %, puede ser + o -
  unidad: string;
  /** Precio de referencia del m² cubierto (venta/alquiler) o tarifa (temporal) YA mezclado con comparables, sin ajustar. */
  precioCubiertoBase: number;
  /** Ese mismo valor, pero después de aplicar SOLO el ajuste por antigüedad (sin el de entorno). */
  precioCubiertoAjustado: number;
  /** Cuánto aporta el cubierto al valor recomendado final, en dólares (con los dos ajustes ya aplicados). */
  aporteCubierto: number;
  /** Cuánto aporta el terreno al valor recomendado final, en dólares. Solo aplica a venta/alquiler con terreno cargado. */
  aporteTerreno: number;
};

const promedio = (nums: number[]) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);
const num0 = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0); // saneo defensivo: nunca negativos ni NaN en una valuación

/**
 * Valor por m² (venta/alquiler) o tarifa por noche (alquiler temporal) que aporta un comparable, si se
 * puede calcular. Se exporta porque la pantalla de Tasaciones la usa para el "Promedio de N comparables"
 * que se ve ANTES de generar — tiene que ser exactamente esta misma cuenta, si no el número que se ve antes
 * de generar no coincide con el que aparece después (confuso e informal para un informe profesional).
 */
export function valorComparable(c: Comparable, esTemporal: boolean): number | null {
  if (!(c.precio > 0)) return null;
  if (esTemporal) return c.precio; // en temporal el precio YA es la tarifa de la unidad completa, no se divide por m²
  return c.m2 && c.m2 > 0 ? c.precio / c.m2 : null;
}

/**
 * Mezcla la referencia propia del tasador con el promedio de los comparables, pesando más el mercado
 * cuantos más comparables reales haya (1 comparable pesa igual que la referencia del tasador -50/50-,
 * pero con 3 ya pesa el 75%, con 5 el ~83%, etc.) — así el método es cada vez más "comparativo" y menos
 * "lo que dice el tasador" a medida que hay más evidencia real de mercado relevada.
 */
function mezclarConMercado(referencia: number, promedioComparables: number | null, cantidad: number): number {
  if (promedioComparables === null) return referencia; // sin comparables: solo la referencia del tasador
  if (!(referencia > 0)) return promedioComparables; // el tasador no cargó una referencia propia: solo el mercado
  const pesoMercado = cantidad / (cantidad + 1);
  return referencia * (1 - pesoMercado) + promedioComparables * pesoMercado;
}

export function calcularValuacion(e: EntradaValuacion): Valuacion {
  const esTemporal = e.operacion === "alquiler_temporal";
  const unidad = OPERACIONES.find((o) => o.value === e.operacion)!.unidad;

  const valores = e.comparables.map((c) => valorComparable(c, esTemporal)).filter((v): v is number => v !== null);
  const promedioComparables = promedio(valores);

  const precioCubiertoBase = mezclarConMercado(num0(e.precioCubierto), promedioComparables, valores.length);
  // El terreno no se mezcla con los comparables: un aviso de un portal da el precio de la propiedad completa
  // (equivalente a $/m² cubierto), no un valor de terreno aparte — mezclarlo ahí ensuciaría la cuenta.
  const precioTerrenoBase = esTemporal ? 0 : num0(e.precioTerreno);

  // Saneo defensivo también acá: un valor inválido (NaN, vacío) nunca debe poder tirar abajo todo el
  // cálculo y devolver null/NaN en una tasación — mejor asumir "sin dato" (0 años, puntuación neutra 3/5).
  const antiguedad = Number.isFinite(e.antiguedad) ? Math.max(e.antiguedad, 0) : 0;
  const puntuacion = (v: number) => (Number.isFinite(v) && v >= 1 && v <= 5 ? v : 3);
  const ajusteAntiguedad = -Math.min(antiguedad * 0.5, 25);
  const promEntorno = (puntuacion(e.transporte) + puntuacion(e.servicios) + puntuacion(e.seguridad) + puntuacion(e.entorno)) / 4;
  const ajusteEntorno = ((promEntorno - 3) / 2) * 10;
  const factor = 1 + (ajusteAntiguedad + ajusteEntorno) / 100;

  const base = esTemporal ? precioCubiertoBase : num0(e.m2Terreno) * precioTerrenoBase + num0(e.m2Cubierto) * precioCubiertoBase;
  const rec = Math.max(0, Math.round(base * factor));

  const factorAntiguedad = 1 + ajusteAntiguedad / 100;
  const precioCubiertoAjustado = precioCubiertoBase * factorAntiguedad;
  const aporteCubierto = esTemporal ? rec : Math.round(num0(e.m2Cubierto) * precioCubiertoBase * factor);
  const aporteTerreno = esTemporal ? 0 : Math.round(num0(e.m2Terreno) * precioTerrenoBase * factor);

  return {
    min: Math.round(rec * 0.92), rec, opt: Math.round(rec * 1.12),
    promedioComparables, comparablesValidos: valores.length, ajusteAntiguedad, ajusteEntorno, unidad,
    precioCubiertoBase, precioCubiertoAjustado, aporteCubierto, aporteTerreno,
  };
}
