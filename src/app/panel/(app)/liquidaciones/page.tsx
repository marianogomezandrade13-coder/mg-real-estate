"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2, FileText, MessageCircle, Check, BadgeCheck, Trash2, Pencil, Wallet, CalendarPlus } from "lucide-react";
import { PageHeader } from "@/components/panel/PageHeader";
import { Modal, Field, Kpi, Vacio, ErrorCarga, inputCls, btnPrimario, btnSecundario } from "@/components/panel/ui";
import { sb, listarClientes, nombreCliente, hoyISO, subirArchivo, urlTemporal, telefonoWa, pctDeCuerpo, type Cliente } from "@/lib/panel-db";
import { construirLiquidacion, netoLiquidacion } from "@/lib/pdf/liquidacion";
import { dinero, periodo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type Liq = Database["public"]["Tables"]["liquidaciones"]["Row"];
type Estado = Liq["estado"];
type Alq = Pick<Database["public"]["Tables"]["alquileres"]["Row"], "id" | "propiedad_id" | "propietario_id" | "canon" | "estado_pago" | "contrato_id">;
type Prop = Pick<Database["public"]["Tables"]["propiedades"]["Row"], "id" | "codigo" | "titulo">;

const ESTADO: Record<Estado, string> = {
  Pendiente: "bg-[#FBF3E2] text-[#8A5A0F]",
  Aprobada: "bg-[#EAF1FB] text-[#2F5FA8]",
  Pagada: "bg-[#EAF7F0] text-[#1F9D5B]",
};

const mesActualISO = () => hoyISO().slice(0, 7);
const redondear = (n: number) => Math.round(n);

type Form = { id?: string; propiedadId: string; periodo: string; cobrado: string; comision: string; gastos: string; retencion: string };
const FORM0 = (): Form => ({ propiedadId: "", periodo: mesActualISO(), cobrado: "", comision: "", gastos: "0", retencion: "0" });

export default function LiquidacionesPage() {
  const [liqs, setLiqs] = useState<Liq[]>([]);
  const [alqs, setAlqs] = useState<Alq[]>([]);
  const [props, setProps] = useState<Prop[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [pct, setPct] = useState(10);
  const [pctContrato, setPctContrato] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filtro, setFiltro] = useState<Estado | "Todas">("Todas");
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [lote, setLote] = useState(false);
  const [mesLote, setMesLote] = useState(mesActualISO());

  const cargar = useCallback(async () => {
    try {
      const [l, a, p, cm, cl] = await Promise.all([
        sb.from("liquidaciones").select("*").order("periodo", { ascending: false }).order("created_at", { ascending: false }),
        sb.from("alquileres").select("id,propiedad_id,propietario_id,canon,estado_pago,contrato_id"),
        sb.from("propiedades").select("id,codigo,titulo"),
        sb.from("comisiones").select("admin_alquiler_pct").is("sucursal_id", null).limit(1),
        listarClientes(),
      ]);
      const err = l.error ?? a.error ?? p.error ?? cm.error;
      if (err) throw new Error(err.message);
      const ct = await sb.from("contratos").select("id,cuerpo").in("id", (a.data ?? []).map((x) => x.contrato_id));
      if (ct.error) throw new Error(ct.error.message);
      const porContrato = new Map((ct.data ?? []).map((c) => [c.id, pctDeCuerpo(c.cuerpo)]));
      const mapa = new Map<string, number>();
      for (const x of a.data ?? []) { const v = porContrato.get(x.contrato_id); if (v != null) mapa.set(x.propiedad_id, v); }
      setPctContrato(mapa);
      setError(null); setLiqs(l.data ?? []); setAlqs(a.data ?? []); setProps(p.data ?? []); setClientes(cl);
      const c = cm.data?.[0]?.admin_alquiler_pct; if (typeof c === "number") setPct(c);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const t = setTimeout(() => void cargar(), 0); return () => clearTimeout(t); }, [cargar]);

  const propPorId = useMemo(() => new Map(props.map((p) => [p.id, p])), [props]);
  const cliPorId = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);
  const alqPorProp = useMemo(() => new Map(alqs.map((a) => [a.propiedad_id, a])), [alqs]);

  const visibles = useMemo(() => (filtro === "Todas" ? liqs : liqs.filter((l) => l.estado === filtro)), [liqs, filtro]);
  const kpi = useMemo(() => {
    const suma = (e: Estado) => liqs.filter((l) => l.estado === e).reduce((s, l) => s + l.neto, 0);
    const n = (e: Estado) => liqs.filter((l) => l.estado === e).length;
    return { pend: n("Pendiente"), pendMonto: suma("Pendiente"), aprob: n("Aprobada"), aprobMonto: suma("Aprobada"), pagMonto: suma("Pagada"), pagN: n("Pagada") };
  }, [liqs]);

  const reemplazar = (l: Liq) => setLiqs((xs) => xs.map((x) => (x.id === l.id ? l : x)));
  const dataPdf = (l: Liq) => ({
    propietario: nombreCliente(cliPorId.get(l.propietario_id)),
    propiedad: `${propPorId.get(l.propiedad_id)?.codigo ?? ""} ${propPorId.get(l.propiedad_id)?.titulo ?? ""}`.trim(),
    periodo: periodo(l.periodo), alquiler: l.alquiler_cobrado, comision: l.comision, gastos: l.gastos, retencion: l.retencion, estado: l.estado,
  });

  /* ------------------------------ Crear / editar ------------------------------ */
  const elegirPropiedad = (id: string) => setForm((f) => {
    if (!f) return f;
    const canon = alqPorProp.get(id)?.canon;
    return canon ? { ...f, propiedadId: id, cobrado: String(canon), comision: String(redondear((canon * (pctContrato.get(id) ?? pct)) / 100)) } : { ...f, propiedadId: id };
  });
  const cambiarCobrado = (v: string) => setForm((f) => {
    if (!f) return f;
    const n = parseFloat(v);
    return { ...f, cobrado: v, comision: n > 0 ? String(redondear((n * (pctContrato.get(f.propiedadId) ?? pct)) / 100)) : f.comision };
  });

  const propiedadesConAlquiler = useMemo(() => props.filter((p) => alqPorProp.has(p.id)), [props, alqPorProp]);

  const guardar = async () => {
    const f = form!;
    const a = alqPorProp.get(f.propiedadId);
    const cobrado = parseFloat(f.cobrado), comision = parseFloat(f.comision) || 0, gastos = parseFloat(f.gastos) || 0, retencion = parseFloat(f.retencion) || 0;
    if (!f.id && !a) return void toast.error("Elegí una propiedad con alquiler activo");
    if (!(cobrado >= 0) || isNaN(cobrado)) return void toast.error("Ingresá el alquiler cobrado");
    if (!/^\d{4}-\d{2}$/.test(f.periodo)) return void toast.error("Elegí el mes de la liquidación");
    if (comision < 0 || gastos < 0 || retencion < 0) return void toast.error("Los importes no pueden ser negativos");
    const neto = netoLiquidacion({ alquiler: cobrado, comision, gastos, retencion });
    if (neto < 0) return void toast.error("El neto no puede ser negativo: revisá comisión, gastos y retención");
    const propiedadId = f.id ? liqs.find((l) => l.id === f.id)?.propiedad_id : f.propiedadId;
    if (liqs.some((l) => l.id !== f.id && l.propiedad_id === propiedadId && l.periodo === f.periodo))
      return void toast.error(`Ya existe una liquidación de ${periodo(f.periodo)} para esa propiedad`);
    setSaving(true);
    try {
      if (f.id) {
        const { data, error } = await sb.from("liquidaciones").update({ periodo: f.periodo, alquiler_cobrado: cobrado, comision, gastos, retencion, neto }).eq("id", f.id).select("*").single();
        if (error || !data) throw new Error(error?.message ?? "No se pudo guardar");
        reemplazar(data); toast.success("Liquidación actualizada");
      } else {
        const { data, error } = await sb.from("liquidaciones").insert({
          propietario_id: a!.propietario_id, propiedad_id: f.propiedadId, periodo: f.periodo, alquiler_cobrado: cobrado, comision, gastos, retencion, neto,
          estado: "Pendiente", pdf_url: null, sucursal_id: null,
        }).select("*").single();
        if (error || !data) throw new Error(error?.message ?? "No se pudo crear");
        setLiqs((xs) => [data, ...xs]); toast.success("Liquidación creada como pendiente");
      }
      setForm(null);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  const generarLote = async () => {
    const existentes = new Set(liqs.filter((l) => l.periodo === mesLote).map((l) => l.propiedad_id));
    const sinLiquidar = alqs.filter((a) => !existentes.has(a.propiedad_id));
    const faltan = sinLiquidar.filter((a) => a.estado_pago === "al_dia");
    const omitidas = sinLiquidar.length - faltan.length;
    if (faltan.length === 0) {
      toast.info(omitidas > 0 ? `${omitidas} alquiler(es) no están al día: cargá esas liquidaciones a mano cuando se cobren` : `Ya están todas las liquidaciones de ${periodo(mesLote)}`);
      setLote(false); return;
    }
    setSaving(true);
    const filas = faltan.map((a) => {
      const comision = redondear((a.canon * (pctContrato.get(a.propiedad_id) ?? pct)) / 100);
      return { propietario_id: a.propietario_id, propiedad_id: a.propiedad_id, periodo: mesLote, alquiler_cobrado: a.canon, comision, gastos: 0, retencion: 0,
        neto: a.canon - comision, estado: "Pendiente" as Estado, pdf_url: null, sucursal_id: null };
    });
    const { data, error } = await sb.from("liquidaciones").insert(filas).select("*");
    setSaving(false);
    if (error) return void toast.error("No se pudieron generar: " + error.message);
    setLiqs((xs) => [...(data ?? []), ...xs].sort((a, b) => b.periodo.localeCompare(a.periodo)));
    setLote(false); toast.success(`${data?.length ?? 0} liquidaciones pendientes creadas para ${periodo(mesLote)}.${omitidas > 0 ? ` Se omitieron ${omitidas} que no están al día.` : ""} Revisá gastos y retenciones antes de aprobarlas.`);
  };

  /* --------------------------------- Acciones --------------------------------- */
  const aprobar = async (l: Liq) => {
    setTrabajando(l.id);
    try {
      const aprobada: Liq = { ...l, estado: "Aprobada" };
      const doc = await construirLiquidacion(dataPdf(aprobada));
      const path = `liquidaciones/${l.id}.pdf`;
      await subirArchivo("pdfs", path, doc.output("blob"));
      const { data, error } = await sb.from("liquidaciones").update({ estado: "Aprobada", pdf_url: path }).eq("id", l.id).select("*").single();
      if (error || !data) throw new Error(error?.message ?? "No se pudo aprobar");
      reemplazar(data); toast.success("Aprobada: el propietario ya la ve en su portal con el PDF");
    } catch (e) { toast.error("No se pudo aprobar: " + (e as Error).message); }
    finally { setTrabajando(null); }
  };

  const pagar = async (l: Liq) => {
    if (!confirm(`¿Confirmás que transferiste ${dinero(l.neto)} al propietario?`)) return;
    setTrabajando(l.id);
    try {
      // El PDF se regenera con el estado final
      let pdf_url = l.pdf_url;
      try {
        const doc = await construirLiquidacion(dataPdf({ ...l, estado: "Pagada" }));
        pdf_url = `liquidaciones/${l.id}.pdf`; await subirArchivo("pdfs", pdf_url, doc.output("blob"));
      } catch { /* si falla el PDF igual se registra el pago */ }
      const { data, error } = await sb.from("liquidaciones").update({ estado: "Pagada", pdf_url }).eq("id", l.id).select("*").single();
      if (error || !data) throw new Error(error?.message ?? "No se pudo registrar");
      reemplazar(data); toast.success("Liquidación marcada como pagada");
    } catch (e) { toast.error((e as Error).message); }
    finally { setTrabajando(null); }
  };

  const descargar = async (l: Liq) => {
    setTrabajando(l.id);
    try {
      if (l.pdf_url) window.location.assign(await urlTemporal("pdfs", l.pdf_url));
      else (await construirLiquidacion(dataPdf(l))).save(`Liquidacion-${l.periodo}.pdf`);
    } catch (e) { toast.error("No se pudo obtener el PDF: " + (e as Error).message); }
    finally { setTrabajando(null); }
  };

  const eliminar = async (l: Liq) => {
    if (!confirm("¿Eliminar esta liquidación pendiente?")) return;
    const { error } = await sb.from("liquidaciones").delete().eq("id", l.id);
    if (error) return void toast.error(error.message);
    setLiqs((xs) => xs.filter((x) => x.id !== l.id)); toast.success("Liquidación eliminada");
  };

  const editar = (l: Liq) => setForm({ id: l.id, propiedadId: l.propiedad_id, periodo: l.periodo, cobrado: String(l.alquiler_cobrado), comision: String(l.comision), gastos: String(l.gastos), retencion: String(l.retencion) });

  const acciones = (l: Liq) => {
    const cli = cliPorId.get(l.propietario_id); const tel = telefonoWa(cli?.telefono);
    const msg = `Hola ${cli?.nombre ?? ""}, ya está disponible tu liquidación de ${periodo(l.periodo)}: neto a transferir ${dinero(l.neto)}.`;
    const ocupado = trabajando === l.id;
    const btn = "p-2 rounded-[6px] text-[#676B63] hover:bg-[#F6F3EC] disabled:opacity-60";
    return (
      <div className="flex items-center gap-0.5 flex-wrap">
        {l.estado === "Pendiente" && (
          <button onClick={() => void aprobar(l)} disabled={ocupado} className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-[6px] bg-[#EAF1FB] text-[#2F5FA8] hover:bg-[#2F5FA8] hover:text-white transition-colors disabled:opacity-60">
            {ocupado ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}Aprobar
          </button>
        )}
        {l.estado === "Aprobada" && (
          <button onClick={() => void pagar(l)} disabled={ocupado} className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-[6px] bg-[#EAF7F0] text-[#1F9D5B] hover:bg-[#1F9D5B] hover:text-white transition-colors disabled:opacity-60">
            {ocupado ? <Loader2 size={12} className="animate-spin" /> : <BadgeCheck size={12} />}Marcar pagada
          </button>
        )}
        {l.estado === "Pendiente" && <button onClick={() => editar(l)} className={btn} title="Editar importes" aria-label="Editar importes"><Pencil size={14} /></button>}
        <button onClick={() => void descargar(l)} disabled={ocupado} className={btn} title="Descargar PDF" aria-label="Descargar PDF"><FileText size={14} /></button>
        {l.estado !== "Pendiente" && (
          <a href={tel ? `https://wa.me/${tel}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer"
            className="p-2 rounded-[6px] text-[#1F9D5B] hover:bg-[#EAF7F0]" title="Avisar por WhatsApp" aria-label="Avisar por WhatsApp"><MessageCircle size={14} /></a>
        )}
        {l.estado === "Pendiente" && <button onClick={() => void eliminar(l)} className="p-2 rounded-[6px] text-[#C0506A] hover:bg-[#FBECEF]" title="Eliminar" aria-label="Eliminar"><Trash2 size={14} /></button>}
      </div>
    );
  };

  const badge = (e: Estado) => <span className={cn("inline-block text-[11px] font-bold px-2.5 py-1 rounded-full", ESTADO[e])}>{e}</span>;
  const previewNeto = form ? netoLiquidacion({ alquiler: parseFloat(form.cobrado) || 0, comision: parseFloat(form.comision) || 0, gastos: parseFloat(form.gastos) || 0, retencion: parseFloat(form.retencion) || 0 }) : 0;
  const sinAlquileres = !loading && !error && alqs.length === 0;

  return (
    <div className="p-4 sm:p-7 space-y-6">
      <PageHeader title="Liquidaciones" subtitle="Rendición mensual a propietarios"
        action={<div className="flex gap-2 flex-wrap">
          <button onClick={() => setLote(true)} disabled={sinAlquileres} className={btnSecundario}><CalendarPlus size={15} /> Generar del mes</button>
          <button onClick={() => setForm(FORM0())} disabled={sinAlquileres} className={btnPrimario}><Plus size={15} /> Nueva liquidación</button>
        </div>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Pendientes" value={String(kpi.pend)} sub={dinero(kpi.pendMonto)} color="text-[#8A5A0F]" />
        <Kpi label="Aprobadas" value={String(kpi.aprob)} sub={`${dinero(kpi.aprobMonto)} por transferir`} color="text-[#2F5FA8]" />
        <Kpi label="Pagadas" value={String(kpi.pagN)} sub={dinero(kpi.pagMonto)} color="text-[#1F9D5B]" />
        <Kpi label="Comisión vigente" value={`${pct}%`} sub="sobre el alquiler cobrado" />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {(["Todas", "Pendiente", "Aprobada", "Pagada"] as const).map((e) => (
          <button key={e} onClick={() => setFiltro(e)} aria-pressed={filtro === e}
            className={cn("shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-semibold border transition-colors", filtro === e ? "bg-[#16201B] text-[#D9BC85] border-[#16201B]" : "bg-white text-[#565B56] border-[#E9E4D8] hover:bg-[#F6F3EC]")}>{e}</button>
        ))}
      </div>

      <div className="bg-white rounded-[16px] shadow-card overflow-hidden">
        {loading ? <div className="flex items-center justify-center py-16 text-[#676B63]"><Loader2 size={20} className="animate-spin mr-2" />Cargando…</div>
        : error ? <ErrorCarga mensaje={error} onReintentar={() => { setLoading(true); void cargar(); }} />
        : sinAlquileres && liqs.length === 0 ? <Vacio icono={<Wallet size={24} />} titulo="Primero necesitás un alquiler activo" texto="Las liquidaciones se arman a partir de los contratos de alquiler. Creá uno en Alquileres." />
        : liqs.length === 0 ? <Vacio icono={<Wallet size={24} />} titulo="Todavía no hay liquidaciones" texto="Generá las del mes con un clic: se calculan con el canon y la comisión vigente, y después las revisás y aprobás."
            accion={<button onClick={() => setLote(true)} className={btnPrimario}>Generar las de este mes</button>} />
        : visibles.length === 0 ? <p className="text-center py-12 text-[13px] text-[#676B63]">No hay liquidaciones {filtro.toLowerCase()}s.</p>
        : (
          <>
            <div className="md:hidden divide-y divide-[#F6F3EC]">
              {visibles.map((l) => (
                <div key={l.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-[#1F2421]">{periodo(l.periodo)}</p>
                      <p className="text-[13px] text-[#565B56] truncate">{nombreCliente(cliPorId.get(l.propietario_id))}</p>
                      <p className="text-[12px] text-[#676B63] truncate">{propPorId.get(l.propiedad_id)?.codigo} · {propPorId.get(l.propiedad_id)?.titulo}</p>
                    </div>
                    {badge(l.estado)}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-2 text-[12px] text-[#565B56]">
                    <span>Cobrado</span><span className="text-right font-medium">{dinero(l.alquiler_cobrado)}</span>
                    <span>Comisión + gastos + ret.</span><span className="text-right font-medium">-{dinero(l.comision + l.gastos + l.retencion)}</span>
                    <span className="font-semibold text-[#1F2421]">Neto</span><span className="text-right font-bold text-[#8A6529] text-[14px]">{dinero(l.neto)}</span>
                  </div>
                  <div className="mt-2">{acciones(l)}</div>
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[960px]">
                <thead><tr className="border-b border-[#E9E4D8]">
                  {["Período", "Propietario / Propiedad", "Cobrado", "Comisión", "Gastos", "Retención", "Neto", "Estado", ""].map((h) => <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#676B63] uppercase tracking-wider">{h}</th>)}
                </tr></thead>
                <tbody>
                  {visibles.map((l) => (
                    <tr key={l.id} className="border-b border-[#F6F3EC] hover:bg-[#F6EEDD] transition-colors">
                      <td className="px-4 py-3 text-[13px] font-semibold text-[#1F2421] whitespace-nowrap">{periodo(l.periodo)}</td>
                      <td className="px-4 py-3"><p className="text-[13px] font-semibold text-[#1F2421]">{nombreCliente(cliPorId.get(l.propietario_id))}</p><p className="text-[11px] text-[#676B63]">{propPorId.get(l.propiedad_id)?.codigo} · {propPorId.get(l.propiedad_id)?.titulo}</p></td>
                      <td className="px-4 py-3 text-[13px]">{dinero(l.alquiler_cobrado)}</td>
                      <td className="px-4 py-3 text-[13px] text-[#C0506A]">-{dinero(l.comision)}</td>
                      <td className="px-4 py-3 text-[13px] text-[#C0506A]">{l.gastos ? `-${dinero(l.gastos)}` : "—"}</td>
                      <td className="px-4 py-3 text-[13px] text-[#C0506A]">{l.retencion ? `-${dinero(l.retencion)}` : "—"}</td>
                      <td className="px-4 py-3 text-[14px] font-bold text-[#1F2421]">{dinero(l.neto)}</td>
                      <td className="px-4 py-3">{badge(l.estado)}</td>
                      <td className="px-4 py-3">{acciones(l)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {form && (
        <Modal titulo={form.id ? "Editar liquidación" : "Nueva liquidación"} onClose={() => setForm(null)} ancho="sm:max-w-md"
          footer={<><button onClick={() => setForm(null)} className={`${btnSecundario} flex-1`}>Cancelar</button>
            <button onClick={() => void guardar()} disabled={saving} className={`${btnPrimario} flex-1`}>{saving && <Loader2 size={14} className="animate-spin" />}Guardar</button></>}>
          <Field label="Propiedad (con alquiler activo)">
            <select value={form.propiedadId} onChange={(e) => elegirPropiedad(e.target.value)} disabled={!!form.id} className={inputCls}>
              <option value="">Elegí la propiedad</option>
              {(form.id ? props : propiedadesConAlquiler).map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.titulo}</option>)}
            </select>
          </Field>
          {form.propiedadId && <p className="text-[12px] text-[#565B56] -mt-2">Propietario: <strong>{nombreCliente(cliPorId.get(alqPorProp.get(form.propiedadId)?.propietario_id ?? liqs.find((l) => l.id === form.id)?.propietario_id ?? ""))}</strong></p>}
          <Field label="Mes que se liquida"><input type="month" value={form.periodo} onChange={(e) => setForm({ ...form, periodo: e.target.value })} className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Alquiler cobrado ($)"><input type="number" inputMode="decimal" min="0" value={form.cobrado} onChange={(e) => cambiarCobrado(e.target.value)} className={inputCls} /></Field>
            <Field label={`Comisión (${pctContrato.get(form.propiedadId) ?? pct}%)`}><input type="number" inputMode="decimal" min="0" value={form.comision} onChange={(e) => setForm({ ...form, comision: e.target.value })} className={inputCls} /></Field>
            <Field label="Gastos ($)"><input type="number" inputMode="decimal" min="0" value={form.gastos} onChange={(e) => setForm({ ...form, gastos: e.target.value })} className={inputCls} /></Field>
            <Field label="Retención ($)"><input type="number" inputMode="decimal" min="0" value={form.retencion} onChange={(e) => setForm({ ...form, retencion: e.target.value })} className={inputCls} /></Field>
          </div>
          <div className="flex justify-between items-center bg-[#F6F3EC] rounded-[10px] p-3">
            <span className="text-[13px] font-semibold text-[#1F2421]">Neto a transferir</span>
            <span className={cn("text-[16px] font-bold", previewNeto < 0 ? "text-[#C0506A]" : "text-[#8A6529]")}>{dinero(previewNeto)}</span>
          </div>
          <p className="text-[11px] text-[#676B63]">Queda pendiente: el propietario la ve recién cuando la aprobás.</p>
        </Modal>
      )}

      {lote && (
        <Modal titulo="Generar liquidaciones del mes" onClose={() => setLote(false)} ancho="sm:max-w-sm"
          footer={<><button onClick={() => setLote(false)} className={`${btnSecundario} flex-1`}>Cancelar</button>
            <button onClick={() => void generarLote()} disabled={saving} className={`${btnPrimario} flex-1`}>{saving && <Loader2 size={14} className="animate-spin" />}Generar</button></>}>
          <Field label="Mes"><input type="month" value={mesLote} onChange={(e) => setMesLote(e.target.value)} className={inputCls} /></Field>
          <p className="text-[13px] text-[#565B56]">Se crea una liquidación pendiente por cada alquiler activo que todavía no tenga una en ese mes, con el canon cobrado y la comisión general del {pct}% (o la pactada en cada contrato si es menor). Después ajustás gastos o retenciones y aprobás.</p>
        </Modal>
      )}
    </div>
  );
}
