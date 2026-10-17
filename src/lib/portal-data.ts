import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Datos del portal. TODAS las consultas usan la sesión del propio cliente (no la clave de servicio),
 * así que la base aplica RLS: aunque se olvidara un filtro acá, no entregaría filas ajenas.
 * Los `.eq(...)` explícitos son una segunda capa (defensa en profundidad).
 */
export type PortalDoc = { id: string; nombre: string; categoria: string; fecha: string };

async function documentos(vinculados: string[]): Promise<PortalDoc[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("documentos").select("id,nombre,categoria,created_at")
    .eq("permiso", "cliente").in("vinculado_a", vinculados).order("created_at", { ascending: false });
  return (data ?? []).map((d) => ({ id: d.id, nombre: d.nombre, categoria: d.categoria, fecha: d.created_at }));
}

export type DatosPropietario = Awaited<ReturnType<typeof datosPropietario>>;

export async function datosPropietario(clienteId: string) {
  const supabase = await createClient();
  const [props, alqs, liqs] = await Promise.all([
    supabase.from("propiedades").select("id,codigo,titulo,direccion,ciudad,estado,operacion,precio,moneda")
      .eq("propietario_id", clienteId).order("codigo"),
    supabase.from("portal_alquileres_propietario").select("id,propiedad_id,canon,proximo_ajuste,indice,estado_pago,dias_mora,inquilino"),
    supabase.from("liquidaciones").select("id,propiedad_id,periodo,alquiler_cobrado,comision,gastos,retencion,neto,estado,pdf_url,created_at")
      .eq("propietario_id", clienteId).order("periodo", { ascending: false }),
  ]);

  const propiedades = props.data ?? [];
  const idsPropios = new Set(propiedades.map((p) => p.id));
  const alquileres = (alqs.data ?? []).filter((a) => idsPropios.has(a.propiedad_id));
  const docs = await documentos([clienteId, ...propiedades.map((p) => p.codigo)]);
  const porId = new Map(propiedades.map((p) => [p.id, p]));
  const liquidaciones = (liqs.data ?? []).map((l) => ({ ...l, propiedadTitulo: porId.get(l.propiedad_id)?.titulo ?? "Propiedad" }));

  return {
    propiedades: propiedades.map((p) => {
      const a = alquileres.find((x) => x.propiedad_id === p.id);
      return { ...p, alquiler: a ? { canon: a.canon, inquilino: a.inquilino, estadoPago: a.estado_pago, proximoAjuste: a.proximo_ajuste, indice: a.indice } : null };
    }),
    liquidaciones,
    documentos: docs,
    error: props.error?.message ?? liqs.error?.message ?? null,
  };
}

export type DatosInquilino = Awaited<ReturnType<typeof datosInquilino>>;

export async function datosInquilino(clienteId: string) {
  const supabase = await createClient();
  const { data: alquiler, error } = await supabase
    .from("alquileres").select("id,contrato_id,propiedad_id,canon,proximo_ajuste,indice,dia_vencimiento,estado_pago,dias_mora")
    .eq("inquilino_id", clienteId).order("created_at", { ascending: false }).limit(1).maybeSingle();

  const [prop, contrato, recibos] = await Promise.all([
    alquiler ? supabase.from("propiedades").select("codigo,titulo,direccion,ciudad").eq("id", alquiler.propiedad_id).maybeSingle() : Promise.resolve({ data: null }),
    alquiler ? supabase.from("contratos").select("id,fecha_inicio,fecha_fin,monto,moneda,estado,pdf_url").eq("id", alquiler.contrato_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("recibos").select("id,numero,concepto,total,moneda,fecha,pdf_url").eq("cliente_id", clienteId).order("fecha", { ascending: false }),
  ]);
  const docs = await documentos([clienteId, ...(prop.data?.codigo ? [prop.data.codigo] : [])]);

  return {
    alquiler: alquiler ?? null,
    propiedad: prop.data ?? null,
    contrato: contrato.data ?? null,
    recibos: recibos.data ?? [],
    documentos: docs,
    error: error?.message ?? null,
  };
}
