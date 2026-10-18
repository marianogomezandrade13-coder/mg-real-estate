"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Plus, Loader2, KeyRound, Upload, FileText, Trash2, TrendingUp, HandCoins } from "lucide-react";
import { PageHeader } from "@/components/panel/PageHeader";
import { EmitirRecibo, type ReciboInicial } from "@/components/panel/EmitirRecibo";
import { ClienteSelect } from "@/components/panel/ClienteSelect";
import { Modal, Field, Kpi, Vacio, ErrorCarga, inputCls, btnPrimario, btnSecundario } from "@/components/panel/ui";
import { sb, listarClientes, nombreCliente, fechaAR, hoyISO, subirArchivo, urlTemporal, pctDeCuerpo, leerPct, type Cliente } from "@/lib/panel-db";
import { revalidarSitioPublico } from "@/lib/revalidar";
import { dinero, periodo } from "@/lib/format";
import { useEsTitular } from "@/lib/rol-context";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type Alq = Database["public"]["Tables"]["alquileres"]["Row"];
type Prop = Pick<Database["public"]["Tables"]["propiedades"]["Row"], "id" | "codigo" | "titulo" | "direccion" | "propietario_id" | "estado">;
type Contrato = Pick<Database["public"]["Tables"]["contratos"]["Row"], "id" | "fecha_inicio" | "fecha_fin" | "pdf_url" | "cuerpo">;
type Indice = Alq["indice"];
type EstadoPago = Alq["estado_pago"];

const INDICES: Indice[] = ["ICL", "IPC", "CasaPropia", "Anual"];
const ESTADO: Record<EstadoPago, { label: string; cls: string }> = {
  al_dia: { label: "Al día", cls: "bg-[#EAF7F0] text-[#1F9D5B]" },
  pendiente: { label: "Pendiente", cls: "bg-[#FBF3E2] text-[#8A5A0F]" },
  vencido: { label: "Vencido", cls: "bg-[#FBECEF] text-[#C0506A]" },
};

const sumarMeses = (iso: string, m: number) => { const d = new Date(`${iso}T12:00:00`); const dia = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + m); d.setDate(Math.min(dia, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return d.toISOString().slice(0, 10); };
const mesActual = () => periodo(hoyISO().slice(0, 7));

const NUEVO0 = { propiedadId: "", propietarioId: "", inquilinoId: "", canon: "", inicio: hoyISO(), fin: "", indice: "ICL" as Indice, ajuste: "", dia: "10", deposito: "", comisionPct: "" };

export default function AlquileresPage() {
  const esTitular = useEsTitular();
  const [alqs, setAlqs] = useState<Alq[]>([]);
  const [props, setProps] = useState<Prop[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nuevo, setNuevo] = useState<typeof NUEVO0 | null>(null);
  const [ajustar, setAjustar] = useState<{ a: Alq; canon: string; proximo: string; comisionPct: string } | null>(null);
  const [pctGeneral, setPctGeneral] = useState(10);
  const [cobro, setCobro] = useState<{ a: Alq; inicial: ReciboInicial } | null>(null);
  const [saving, setSaving] = useState(false);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const contratoParaSubir = useRef<Contrato | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [a, p, c, cl, cm] = await Promise.all([
        sb.from("alquileres").select("*").order("created_at", { ascending: false }),
        sb.from("propiedades").select("id,codigo,titulo,direccion,propietario_id,estado").order("codigo"),
        sb.from("contratos").select("id,fecha_inicio,fecha_fin,pdf_url,cuerpo"),
        listarClientes(),
        sb.from("comisiones").select("admin_alquiler_pct").is("sucursal_id", null).limit(1),
      ]);
      const general = cm.data?.[0]?.admin_alquiler_pct; if (typeof general === "number") setPctGeneral(general);
      const err = a.error ?? p.error ?? c.error;
      if (err) throw new Error(err.message);
      setError(null); setAlqs(a.data ?? []); setProps(p.data ?? []); setContratos(c.data ?? []); setClientes(cl);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const t = setTimeout(() => void cargar(), 0); return () => clearTimeout(t); }, [cargar]);

  const propPorId = useMemo(() => new Map(props.map((p) => [p.id, p])), [props]);
  const cliPorId = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);
  const conPorId = useMemo(() => new Map(contratos.map((c) => [c.id, c])), [contratos]);
  const libres = useMemo(() => { const ocupadas = new Set(alqs.map((a) => a.propiedad_id)); return props.filter((p) => !ocupadas.has(p.id) && p.estado !== "Vendida"); }, [props, alqs]);

  const kpi = useMemo(() => {
    const hoy = hoyISO(), en30 = sumarMeses(hoy, 1);
    const mora = alqs.filter((a) => a.estado_pago !== "al_dia");
    return {
      activos: alqs.length, alDia: alqs.filter((a) => a.estado_pago === "al_dia").length,
      mora: mora.length, moraMonto: mora.reduce((s, a) => s + a.canon, 0),
      ajustes: alqs.filter((a) => a.proximo_ajuste <= en30).length,
    };
  }, [alqs]);

  const actualizarSitio = () => { void revalidarSitioPublico().catch(() => {}); };
  const reemplazar = (a: Alq) => setAlqs((xs) => xs.map((x) => (x.id === a.id ? a : x)));

  /* ------------------------------ Nuevo contrato ------------------------------ */
  const elegirPropiedad = (id: string) => setNuevo((n) => n && ({ ...n, propiedadId: id, propietarioId: propPorId.get(id)?.propietario_id ?? n.propietarioId }));
  const cambiarInicio = (v: string) => setNuevo((n) => n && ({ ...n, inicio: v, ajuste: v ? sumarMeses(v, 6) : "" }));

  const crear = async () => {
    const n = nuevo!; const canon = parseFloat(n.canon);
    if (!n.propiedadId) return void toast.error("Elegí la propiedad");
    if (!n.propietarioId) return void toast.error("Elegí el propietario (locador)");
    if (!n.inquilinoId) return void toast.error("Elegí el inquilino");
    if (!(canon > 0)) return void toast.error("Ingresá el canon mensual");
    if (!n.inicio || !n.fin) return void toast.error("Completá las fechas de inicio y fin");
    if (n.fin < n.inicio) return void toast.error("La fecha de fin no puede ser anterior al inicio");
    const pct = leerPct(n.comisionPct);
    if (pct === undefined) return void toast.error("La comisión debe ser un porcentaje entre 0 y 100");
    setSaving(true);
    try {
      const k = await sb.from("contratos").insert({
        tipo: "alq_viv", propiedad_id: n.propiedadId, parte_a_id: n.propietarioId, parte_b_id: n.inquilinoId, monto: canon, moneda: "ARS",
        indice_ajuste: n.indice, fecha_inicio: n.inicio, fecha_fin: n.fin, estado: "firmado", pdf_url: null,
        cuerpo: n.deposito || pct !== null ? { ...(n.deposito ? { deposito: parseFloat(n.deposito) } : {}), ...(pct !== null ? { comision_pct: pct } : {}) } : null, sucursal_id: null,
      }).select("id,fecha_inicio,fecha_fin,pdf_url,cuerpo").single();
      if (k.error || !k.data) throw new Error(k.error?.message ?? "No se pudo crear el contrato");

      const a = await sb.from("alquileres").insert({
        contrato_id: k.data.id, propiedad_id: n.propiedadId, inquilino_id: n.inquilinoId, propietario_id: n.propietarioId, canon,
        proximo_ajuste: n.ajuste || sumarMeses(n.inicio, 6), indice: n.indice, dia_vencimiento: Math.min(28, Math.max(1, parseInt(n.dia, 10) || 10)),
        estado_pago: "al_dia", dias_mora: 0, sucursal_id: null,
      }).select("*").single();
      if (a.error || !a.data) { await sb.from("contratos").delete().eq("id", k.data.id); throw new Error(a.error?.message ?? "No se pudo crear el alquiler"); }

      // La propiedad pasa a Alquilada, se retira de la web y queda vinculada a su propietario (base del portal)
      const { error: eProp } = await sb.from("propiedades").update({ estado: "Alquilada", publicada_web: false, propietario_id: n.propietarioId }).eq("id", n.propiedadId);
      if (eProp) toast.warning("El contrato se creó, pero no se pudo marcar la propiedad como alquilada: " + eProp.message);
      actualizarSitio();
      setAlqs((xs) => [a.data, ...xs]); setContratos((cs) => [...cs, k.data]);
      setProps((ps) => ps.map((p) => (p.id === n.propiedadId ? { ...p, estado: "Alquilada", propietario_id: n.propietarioId } : p)));
      setNuevo(null);
      toast.success("Contrato creado. El inquilino y el propietario ya pueden verlo en su portal (si tienen acceso).");
    } catch (e) { toast.error("No se pudo crear: " + (e as Error).message); }
    finally { setSaving(false); }
  };

  /* --------------------------------- Acciones --------------------------------- */
  const cambiarEstadoPago = async (a: Alq, estado: EstadoPago) => {
    const { data, error } = await sb.from("alquileres").update({ estado_pago: estado, dias_mora: estado === "al_dia" ? 0 : a.dias_mora }).eq("id", a.id).select("*").single();
    if (error || !data) return void toast.error(error?.message ?? "No se pudo actualizar");
    reemplazar(data);
  };

  const guardarAjuste = async () => {
    const x = ajustar!; const canon = parseFloat(x.canon);
    if (!(canon > 0) || !x.proximo) return void toast.error("Completá el nuevo canon y la fecha del próximo ajuste");
    const pct = leerPct(x.comisionPct);
    if (pct === undefined) return void toast.error("La comisión debe ser un porcentaje entre 0 y 100");
    setSaving(true);
    const { data, error } = await sb.from("alquileres").update({ canon, proximo_ajuste: x.proximo }).eq("id", x.a.id).select("*").single();
    const previo = conPorId.get(x.a.contrato_id)?.cuerpo;
    const base: Record<string, unknown> = previo && typeof previo === "object" && !Array.isArray(previo) ? { ...(previo as Record<string, unknown>) } : {};
    if (pct === null) delete base.comision_pct; else base.comision_pct = pct;
    const cuerpo = (Object.keys(base).length ? base : null) as Contrato["cuerpo"];
    const rc = error ? null : await sb.from("contratos").update({ monto: canon, cuerpo }).eq("id", x.a.contrato_id).select("id,fecha_inicio,fecha_fin,pdf_url,cuerpo").single();
    const eContrato = rc?.error ?? null;
    if (rc?.data) { const nuevoC = rc.data; setContratos((cs) => cs.map((c) => (c.id === nuevoC.id ? nuevoC : c))); }
    setSaving(false);
    if (eContrato) toast.warning("Canon actualizado, pero no se pudo actualizar el monto del contrato: " + eContrato.message);
    if (error || !data) return void toast.error(error?.message ?? "No se pudo guardar");
    reemplazar(data); setAjustar(null); toast.success("Canon actualizado");
  };

  const darDeBaja = async (a: Alq) => {
    const p = propPorId.get(a.propiedad_id);
    if (!confirm(`¿Dar de baja el alquiler de ${p?.codigo ?? "la propiedad"}? La propiedad vuelve a estar disponible y el inquilino deja de ver el contrato en su portal.`)) return;
    const { error } = await sb.from("alquileres").delete().eq("id", a.id);
    if (error) return void toast.error(error.message);
    const { error: eProp } = await sb.from("propiedades").update({ estado: "Activa" }).eq("id", a.propiedad_id);
    if (eProp) toast.warning("Se dio de baja el alquiler, pero la propiedad no volvió a Activa: " + eProp.message);
    actualizarSitio();
    setAlqs((xs) => xs.filter((x) => x.id !== a.id));
    setProps((ps) => ps.map((x) => (x.id === a.propiedad_id ? { ...x, estado: "Activa" } : x)));
    toast.success("Alquiler dado de baja");
  };

  const elegirArchivoContrato = (k: Contrato | undefined) => { if (!k) return; contratoParaSubir.current = k; fileRef.current?.click(); };
  const subirContrato = async (files: FileList | null) => {
    const f = files?.[0]; const k = contratoParaSubir.current;
    if (fileRef.current) fileRef.current.value = "";
    if (!f || !k) return;
    if (f.type !== "application/pdf") return void toast.error("El contrato debe ser un archivo PDF");
    if (f.size > 20 * 1024 * 1024) return void toast.error("El PDF supera los 20 MB");
    setSubiendo(k.id);
    try {
      const path = await subirArchivo("pdfs", `contratos/${k.id}.pdf`, f);
      const { error } = await sb.from("contratos").update({ pdf_url: path }).eq("id", k.id);
      if (error) throw new Error(error.message);
      setContratos((cs) => cs.map((c) => (c.id === k.id ? { ...c, pdf_url: path } : c)));
      toast.success("Contrato cargado: el inquilino y el propietario pueden descargarlo");
    } catch (e) { toast.error("No se pudo subir: " + (e as Error).message); }
    finally { setSubiendo(null); }
  };
  const verContrato = async (k: Contrato) => { try { window.location.assign(await urlTemporal("pdfs", k.pdf_url!)); } catch (e) { toast.error((e as Error).message); } };

  const abrirCobro = (a: Alq) => setCobro({
    a, inicial: { clienteId: a.inquilino_id, concepto: `Alquiler ${mesActual()} · ${propPorId.get(a.propiedad_id)?.codigo ?? ""}`.trim(), monto: a.canon, moneda: "ARS", iva: false },
  });

  /* ---------------------------------- Vista ---------------------------------- */
  const fila = (a: Alq) => {
    const p = propPorId.get(a.propiedad_id), k = conPorId.get(a.contrato_id), inq = cliPorId.get(a.inquilino_id);
    const btn = "p-2 rounded-[6px] hover:bg-[#F6F3EC] text-[#676B63]";
    const verContratoBtn = k?.pdf_url ? <button onClick={() => void verContrato(k)} className={btn} title="Ver contrato firmado" aria-label="Ver contrato firmado"><FileText size={14} /></button> : null;
    return { p, k, inq, acciones: !esTitular ? <div className="flex items-center gap-0.5">{verContratoBtn}</div> : (
      <div className="flex items-center gap-0.5 flex-wrap">
        <button onClick={() => abrirCobro(a)} className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-[6px] bg-[#EAF7F0] text-[#1F9D5B] hover:bg-[#1F9D5B] hover:text-white transition-colors"><HandCoins size={13} />Registrar cobro</button>
        <button onClick={() => setAjustar({ a, canon: String(a.canon), proximo: a.proximo_ajuste, comisionPct: String(pctDeCuerpo(k?.cuerpo) ?? "") })} className={btn} title="Ajustar canon y comisión" aria-label="Ajustar canon y comisión"><TrendingUp size={14} /></button>
        {verContratoBtn}
        <button onClick={() => elegirArchivoContrato(k)} disabled={subiendo === k?.id} className={btn} title={k?.pdf_url ? "Reemplazar contrato PDF" : "Subir contrato firmado (PDF)"} aria-label="Subir contrato PDF">
          {subiendo === k?.id ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        </button>
        <button onClick={() => void darDeBaja(a)} className="p-2 rounded-[6px] text-[#C0506A] hover:bg-[#FBECEF]" title="Dar de baja" aria-label="Dar de baja"><Trash2 size={14} /></button>
      </div>) };
  };
  const selectEstado = (a: Alq) => !esTitular ? (
    <span className={cn("text-[11px] font-bold rounded-full px-2.5 py-1", ESTADO[a.estado_pago].cls)}>{ESTADO[a.estado_pago].label}</span>
  ) : (
    <select value={a.estado_pago} onChange={(e) => void cambiarEstadoPago(a, e.target.value as EstadoPago)} aria-label="Estado de pago"
      className={cn("text-[11px] font-bold rounded-full px-2.5 py-1 outline-none cursor-pointer border-0 appearance-none", ESTADO[a.estado_pago].cls)}>
      {(Object.keys(ESTADO) as EstadoPago[]).map((e) => <option key={e} value={e}>{ESTADO[e].label}</option>)}
    </select>
  );

  return (
    <div className="p-4 sm:p-7 space-y-6">
      <PageHeader title="Gestión de alquileres" subtitle="Contratos, cobros y ajustes de canon"
        action={esTitular && <button onClick={() => setNuevo({ ...NUEVO0, inicio: hoyISO(), ajuste: sumarMeses(hoyISO(), 6) })} className={btnPrimario}><Plus size={15} /> Nuevo contrato</button>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Contratos activos" value={String(kpi.activos)} sub={`${kpi.alDia} al día`} />
        <Kpi label="Al día" value={String(kpi.alDia)} sub={kpi.activos ? `${Math.round((kpi.alDia / kpi.activos) * 100)}% de los contratos` : "—"} color="text-[#1F9D5B]" />
        <Kpi label="Con deuda" value={String(kpi.mora)} sub={kpi.mora ? `${dinero(kpi.moraMonto)} de canon` : "Sin deuda"} color={kpi.mora ? "text-[#C0506A]" : "text-[#1F2421]"} />
        <Kpi label="Ajustes próximos" value={String(kpi.ajustes)} sub="en los próximos 30 días" color="text-[#8A5A0F]" />
      </div>

      <div className="bg-[#16201B] rounded-[16px] p-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
        <div className="w-12 h-12 rounded-[12px] bg-[#8A6529]/20 flex items-center justify-center flex-shrink-0"><span className="text-[#D9BC85] text-[18px] font-bold">%</span></div>
        <div className="flex-1">
          <p className="text-white font-bold text-[15px]">Calculadora de índices · ICL / IPC / Casa Propia</p>
          <p className="text-[#8E9389] text-[12px] mt-0.5">Calculá el ajuste de cada contrato con los índices oficiales y cargalo con el botón de ajuste.</p>
        </div>
        <a href="https://www.ccpim.com.ar/interna/calculadora-alquileres/309" target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-[#8A6529] text-white text-[13px] font-semibold px-4 py-2.5 rounded-[10px] hover:bg-[#6E4F1F] transition-colors sm:flex-shrink-0">
          Abrir calculadora ICL <ExternalLink size={13} />
        </a>
      </div>

      <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => void subirContrato(e.target.files)} />

      <div className="bg-white rounded-[16px] shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E9E4D8]"><h2 className="text-[15px] font-bold text-[#1F2421]">Contratos de alquiler activos</h2></div>
        {loading ? <div className="flex items-center justify-center py-16 text-[#676B63]"><Loader2 size={20} className="animate-spin mr-2" />Cargando…</div>
        : error ? <ErrorCarga mensaje={error} onReintentar={() => { setLoading(true); void cargar(); }} />
        : alqs.length === 0 ? <Vacio icono={<KeyRound size={24} />} titulo="Todavía no hay contratos de alquiler"
            texto="Creá el primero para vincular un inquilino con una propiedad. Desde ahí se registran cobros, ajustes y liquidaciones, y tus clientes lo ven en su portal."
            accion={esTitular ? <button onClick={() => setNuevo({ ...NUEVO0, inicio: hoyISO(), ajuste: sumarMeses(hoyISO(), 6) })} className={btnPrimario}>Crear el primer contrato</button> : undefined} />
        : (
          <>
            <div className="md:hidden divide-y divide-[#F6F3EC]">
              {alqs.map((a) => { const { p, k, inq, acciones } = fila(a); return (
                <div key={a.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="text-[13px] font-bold text-[#1F2421]">{p?.codigo} · {p?.titulo}</p><p className="text-[12px] text-[#676B63]">{nombreCliente(inq)}</p></div>
                    {selectEstado(a)}
                  </div>
                  <p className="text-[16px] font-bold text-[#8A6529] mt-2">{dinero(a.canon)}<span className="text-[11px] font-medium text-[#676B63]">/mes</span></p>
                  <p className="text-[11px] text-[#676B63]">{fechaAR(k?.fecha_inicio)} → {fechaAR(k?.fecha_fin)} · ajuste {fechaAR(a.proximo_ajuste)} ({a.indice})</p>
                  <div className="mt-2">{acciones}</div>
                </div>); })}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead><tr className="border-b border-[#E9E4D8]">
                  {["Inmueble / Inquilino", "Vigencia", "Canon", "Próx. ajuste", "Estado de pago", "Acciones"].map((h) => <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#676B63] uppercase tracking-wider">{h}</th>)}
                </tr></thead>
                <tbody>
                  {alqs.map((a) => { const { p, k, inq, acciones } = fila(a); return (
                    <tr key={a.id} className="border-b border-[#F6F3EC] hover:bg-[#F6EEDD] transition-colors">
                      <td className="px-4 py-3"><p className="text-[13px] font-semibold text-[#1F2421]">{p?.codigo} · {p?.titulo}</p><p className="text-[11px] text-[#676B63]">{nombreCliente(inq)}</p></td>
                      <td className="px-4 py-3 text-[12px] text-[#565B56]">{fechaAR(k?.fecha_inicio)} → {fechaAR(k?.fecha_fin)}</td>
                      <td className="px-4 py-3 text-[14px] font-bold text-[#1F2421]">{dinero(a.canon)}</td>
                      <td className="px-4 py-3 text-[12px] text-[#565B56]">{fechaAR(a.proximo_ajuste)}<span className="block text-[11px] text-[#676B63]">{a.indice}</span></td>
                      <td className="px-4 py-3">{selectEstado(a)}</td>
                      <td className="px-4 py-3">{acciones}</td>
                    </tr>); })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Nuevo contrato */}
      {nuevo && (
        <Modal titulo="Nuevo contrato de alquiler" onClose={() => setNuevo(null)} ancho="sm:max-w-xl"
          footer={<><button onClick={() => setNuevo(null)} className={`${btnSecundario} flex-1`}>Cancelar</button>
            <button onClick={() => void crear()} disabled={saving} className={`${btnPrimario} flex-1`}>{saving && <Loader2 size={14} className="animate-spin" />}{saving ? "Creando…" : "Crear contrato"}</button></>}>
          <Field label="Propiedad" hint={libres.length === 0 ? "No hay propiedades libres: cargá una en Propiedades." : undefined}>
            <select value={nuevo.propiedadId} onChange={(e) => elegirPropiedad(e.target.value)} className={inputCls}>
              <option value="">Elegí la propiedad</option>
              {libres.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.titulo}</option>)}
            </select>
          </Field>
          <Field label="Propietario (locador)">
            <ClienteSelect value={nuevo.propietarioId} onChange={(id) => setNuevo({ ...nuevo, propietarioId: id })} clientes={clientes} onCreado={(c) => setClientes((cs) => [...cs, c])} tipos={["propietario"]} tipoNuevo="propietario" placeholder="Elegí el propietario" />
          </Field>
          <Field label="Inquilino (locatario)">
            <ClienteSelect value={nuevo.inquilinoId} onChange={(id) => setNuevo({ ...nuevo, inquilinoId: id })} clientes={clientes} onCreado={(c) => setClientes((cs) => [...cs, c])} tipos={["inquilino"]} tipoNuevo="inquilino" placeholder="Elegí el inquilino" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Canon mensual ($)"><input type="number" inputMode="decimal" min="0" value={nuevo.canon} onChange={(e) => setNuevo({ ...nuevo, canon: e.target.value })} className={inputCls} /></Field>
            <Field label="Depósito ($, opcional)"><input type="number" inputMode="decimal" min="0" value={nuevo.deposito} onChange={(e) => setNuevo({ ...nuevo, deposito: e.target.value })} className={inputCls} /></Field>
            <Field label="Inicio"><input type="date" value={nuevo.inicio} onChange={(e) => cambiarInicio(e.target.value)} className={inputCls} /></Field>
            <Field label="Fin"><input type="date" value={nuevo.fin} onChange={(e) => setNuevo({ ...nuevo, fin: e.target.value })} className={inputCls} /></Field>
            <Field label="Índice de ajuste"><select value={nuevo.indice} onChange={(e) => setNuevo({ ...nuevo, indice: e.target.value as Indice })} className={inputCls}>{INDICES.map((i) => <option key={i}>{i}</option>)}</select></Field>
            <Field label="Próximo ajuste"><input type="date" value={nuevo.ajuste} onChange={(e) => setNuevo({ ...nuevo, ajuste: e.target.value })} className={inputCls} /></Field>
            <Field label="Comisión (%)" hint={`Vacío = la general (${pctGeneral}%). Poné menos para hacer un descuento.`}><input type="number" inputMode="decimal" min="0" max="100" step="0.5" value={nuevo.comisionPct} onChange={(e) => setNuevo({ ...nuevo, comisionPct: e.target.value })} placeholder={`${pctGeneral}`} className={inputCls} /></Field>
            <Field label="Día de vencimiento" hint="Del 1 al 28"><input type="number" min="1" max="28" value={nuevo.dia} onChange={(e) => setNuevo({ ...nuevo, dia: e.target.value })} className={inputCls} /></Field>
          </div>
          <p className="text-[11px] text-[#676B63]">Al crearlo, la propiedad pasa a “Alquilada” y se retira de la web. Después podés subir el contrato firmado en PDF.</p>
        </Modal>
      )}

      {/* Ajustar canon */}
      {ajustar && (
        <Modal titulo="Ajustar canon" onClose={() => setAjustar(null)} ancho="sm:max-w-sm"
          footer={<><button onClick={() => setAjustar(null)} className={`${btnSecundario} flex-1`}>Cancelar</button>
            <button onClick={() => void guardarAjuste()} disabled={saving} className={`${btnPrimario} flex-1`}>{saving && <Loader2 size={14} className="animate-spin" />}Guardar</button></>}>
          <p className="text-[13px] text-[#565B56]">Canon actual: <strong>{dinero(ajustar.a.canon)}</strong> · índice {ajustar.a.indice}</p>
          <Field label="Nuevo canon mensual ($)"><input type="number" inputMode="decimal" min="0" value={ajustar.canon} onChange={(e) => setAjustar({ ...ajustar, canon: e.target.value })} className={inputCls} /></Field>
          <Field label="Fecha del próximo ajuste"><input type="date" value={ajustar.proximo} onChange={(e) => setAjustar({ ...ajustar, proximo: e.target.value })} className={inputCls} /></Field>
          <Field label="Comisión de administración (%)" hint={`Vacío = la general (${pctGeneral}%). Rige para las próximas liquidaciones.`}><input type="number" inputMode="decimal" min="0" max="100" step="0.5" value={ajustar.comisionPct} onChange={(e) => setAjustar({ ...ajustar, comisionPct: e.target.value })} placeholder={`${pctGeneral}`} className={inputCls} /></Field>
        </Modal>
      )}

      {/* Registrar cobro = emitir recibo prellenado */}
      {cobro && (
        <EmitirRecibo clientes={clientes} onClienteCreado={(c) => setClientes((cs) => [...cs, c])} inicial={cobro.inicial}
          onClose={() => setCobro(null)}
          onEmitido={async (r) => {
            const a = cobro.a;
            // Solo se marca "Al día" si el recibo cubre el canon completo en la misma moneda: un pago
            // parcial (o en otra moneda, que no se puede comparar sin una cotización) no debe ocultar la deuda.
            if (r.moneda === "ARS" && r.total >= a.canon) await cambiarEstadoPago(a, "al_dia");
            else toast.message("Recibo emitido. El monto no cubre el canon completo (o está en otra moneda): revisá el estado de pago a mano si hace falta.");
          }} />
      )}
    </div>
  );
}
