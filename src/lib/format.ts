/** Formatos de moneda y fecha (es-AR) compartidos por sitio, panel y portal. */
export function dinero(n: number | null | undefined, moneda: "USD" | "ARS" = "ARS") {
  if (n == null) return "—";
  const v = n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
  return moneda === "USD" ? `USD ${v}` : `$ ${v}`;
}

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/** "2026-06" → "Junio 2026" */
export function periodo(p: string) {
  const [y, m] = p.split("-");
  const i = Number(m) - 1;
  return MESES[i] ? `${MESES[i]} ${y}` : p;
}

/** "2026-06-10" o ISO → "10 jun 2026" */
export function fechaCorta(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3).toLowerCase()} ${d.getFullYear()}`;
}

/** "2026-08-01" → "Ago 2026" */
export function mesAnio(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? "—" : `${MESES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

/** Próxima fecha con ese día del mes (para "próximo vencimiento") */
export function proximoVencimiento(dia: number, desde = new Date()) {
  const d = new Date(desde.getFullYear(), desde.getMonth(), Math.min(dia, 28));
  if (d < new Date(desde.getFullYear(), desde.getMonth(), desde.getDate())) d.setMonth(d.getMonth() + 1);
  return d;
}
