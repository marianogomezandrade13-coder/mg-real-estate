import { getStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TABLAS = [
  "sucursales", "usuarios", "clientes", "propiedades", "propiedad_medios", "leads", "lead_actividades", "captaciones", "tasaciones",
  "contratos", "firmas", "alquileres", "indices", "liquidaciones", "recibos", "caja_cierres", "movimientos_caja",
  "movimientos_finanzas", "documentos", "eventos_agenda", "comisiones", "auditoria",
] as const;

/**
 * Copia de seguridad: descarga un archivo con TODAS las tablas del sistema. Solo el titular.
 * Usa la sesión del propio titular (la base aplica sus permisos), no la clave de servicio.
 * No incluye los archivos (fotos y PDFs): esos quedan guardados en Supabase Storage.
 */
export async function GET() {
  const staff = await getStaff();
  if (!staff || staff.rol !== "titular") return new Response("Solo el titular puede descargar la copia de seguridad.", { status: 403 });

  const supabase = await createClient();
  const copia: Record<string, unknown> = {};
  const errores: string[] = [];
  const PAGINA = 1000;

  for (const tabla of TABLAS) {
    const filas: unknown[] = [];
    for (let desde = 0; ; desde += PAGINA) {
      const { data, error } = await supabase.from(tabla).select("*").range(desde, desde + PAGINA - 1);
      if (error) { errores.push(`${tabla}: ${error.message}`); break; }
      filas.push(...(data ?? []));
      if (!data || data.length < PAGINA) break;
    }
    copia[tabla] = filas;
  }

  const ahora = new Date();
  const cuerpo = JSON.stringify({
    sistema: "MG Real Estate", generada: ahora.toISOString(), por: staff.email,
    cantidades: Object.fromEntries(Object.entries(copia).map(([k, v]) => [k, (v as unknown[]).length])),
    errores, tablas: copia,
  }, null, 1);

  const fecha = ahora.toISOString().slice(0, 10);
  return new Response(cuerpo, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="copia-mg-real-estate-${fecha}.json"`,
      "cache-control": "no-store",
    },
  });
}
