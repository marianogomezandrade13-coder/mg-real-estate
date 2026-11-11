"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Lock, Loader2, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/panel/PageHeader";
import { Modal, Field, ErrorCarga, inputCls, btnPrimario, btnSecundario } from "@/components/panel/ui";
import { sb, hoyISO } from "@/lib/panel-db";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type Mov = Database["public"]["Tables"]["movimientos_caja"]["Row"];
type Cierre = Database["public"]["Tables"]["caja_cierres"]["Row"];
type Medio = Mov["medio"];

const MEDIOS: Medio[] = ["efectivo", "transferencia", "cheque", "tarjeta"];
const CATEGORIAS = ["Alquileres", "Comisiones", "Tasaciones", "Gastos", "Otros"];
const fmt = (v: number) => `$ ${Math.round(v).toLocaleString("es-AR")}`;
const FORM0 = { concepto: "", categoria: CATEGORIAS[0], medio: "efectivo" as Medio, monto: "", ingreso: true };

export default function CajaPage() {
  const [movs, setMovs] = useState<Mov[]>([]);
  const [cierreHoy, setCierreHoy] = useState<Cierre | null>(null);
  const [ultimoCierre, setUltimoCierre] = useState<Cierre | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(FORM0);
  const [guardando, setGuardando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [sinCerrar, setSinCerrar] = useState({ neto: 0, cantidad: 0 });

  const hoy = hoyISO();

  const cargar = useCallback(async () => {
    const [m, ch, uc] = await Promise.all([
      sb.from("movimientos_caja").select("*").eq("fecha", hoy).order("hora"),
      sb.from("caja_cierres").select("*").eq("fecha", hoy).eq("tipo", "diario").maybeSingle(),
      sb.from("caja_cierres").select("*").eq("tipo", "diario").lt("fecha", hoy).order("fecha", { ascending: false }).limit(1).maybeSingle(),
    ]);
    // Movimientos de días anteriores que nunca se cerraron: entran en la apertura de hoy para que el saldo no pierda plata.
    let previos = sb.from("movimientos_caja").select("monto,es_ingreso,fecha").lt("fecha", hoy);
    if (uc.data) previos = previos.gt("fecha", uc.data.fecha);
    const pv = await previos;
    const err = m.error ?? ch.error ?? uc.error ?? pv.error;
    if (err) setError(err.message); else {
      setError(null); setMovs(m.data ?? []); setCierreHoy(ch.data ?? null); setUltimoCierre(uc.data ?? null);
      setSinCerrar({ neto: (pv.data ?? []).reduce((a, x) => a + (x.es_ingreso ? x.monto : -x.monto), 0), cantidad: (pv.data ?? []).length });
    }
    setLoading(false);
  }, [hoy]);
  useEffect(() => { const t = setTimeout(() => void cargar(), 0); return () => clearTimeout(t); }, [cargar]);

  const cerrada = !!cierreHoy;
  const apertura = (ultimoCierre?.saldo ?? 0) + sinCerrar.neto;
  const totalIngresos = useMemo(() => movs.filter((m) => m.es_ingreso).reduce((a, m) => a + m.monto, 0), [movs]);
  const totalEgresos = useMemo(() => movs.filter((m) => !m.es_ingreso).reduce((a, m) => a + m.monto, 0), [movs]);
  const saldo = apertura + totalIngresos - totalEgresos;

  const agregar = async () => {
    if (!form.concepto.trim()) return void toast.error("Escribí el concepto");
    const monto = parseFloat(form.monto);
    if (!(monto > 0)) return void toast.error("Ingresá un monto válido");
    setGuardando(true);
    try {
      const hora = new Date().toTimeString().slice(0, 8);
      const { data, error } = await sb.from("movimientos_caja").insert({
        fecha: hoy, hora, concepto: form.concepto.trim(), categoria: form.categoria, medio: form.medio, monto, es_ingreso: form.ingreso, cierre_id: null, sucursal_id: null,
      }).select("*").single();
      if (error || !data) throw new Error(error?.message ?? "No se pudo registrar");
      setMovs((xs) => [...xs, data].sort((a, b) => a.hora.localeCompare(b.hora)));
      setShowModal(false); setForm(FORM0);
      toast.success("Movimiento registrado");
    } catch (e) { toast.error((e as Error).message); }
    finally { setGuardando(false); }
  };

  const eliminar = async (m: Mov) => {
    if (!confirm(`¿Eliminar "${m.concepto}"?`)) return;
    const { error } = await sb.from("movimientos_caja").delete().eq("id", m.id);
    if (error) return void toast.error(error.message);
    setMovs((xs) => xs.filter((x) => x.id !== m.id));
    toast.success("Movimiento eliminado");
  };

  const cerrarCaja = async () => {
    if (!confirm(`¿Cerrar la caja de hoy con saldo ${fmt(saldo)}? No vas a poder agregar más movimientos de hoy después de cerrarla.`)) return;
    setCerrando(true);
    try {
      const { data, error } = await sb.from("caja_cierres").insert({
        fecha: hoy, apertura, total_ingresos: totalIngresos, total_egresos: totalEgresos, saldo, tipo: "diario", sucursal_id: null,
      }).select("*").single();
      if (error || !data) throw new Error(error?.message ?? "No se pudo cerrar la caja");
      const ids = movs.map((m) => m.id);
      if (ids.length) {
        const { error: eMov } = await sb.from("movimientos_caja").update({ cierre_id: data.id }).in("id", ids);
        if (eMov) toast.warning("La caja se cerró, pero no se pudieron vincular los movimientos al cierre: " + eMov.message);
      }
      setCierreHoy(data);
      toast.success("Caja cerrada correctamente");
    } catch (e) { toast.error((e as Error).message); }
    finally { setCerrando(false); }
  };

  return (
    <div className="p-4 sm:p-7 space-y-6">
      <PageHeader title="Caja diaria" subtitle={`Hoy · ${new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}`}
        action={!loading && !error && (
          <div className="flex gap-2">
            <button onClick={() => setShowModal(true)} disabled={cerrada} className={cn(btnPrimario, "disabled:opacity-50")}><Plus size={15} /> Movimiento</button>
            <button onClick={() => void cerrarCaja()} disabled={cerrada || cerrando}
              className="flex items-center gap-2 bg-[#16201B] text-white text-[13px] font-semibold px-4 py-2.5 rounded-[10px] hover:bg-[#1F2C26] transition-colors disabled:opacity-50">
              {cerrando ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />} Cerrar caja
            </button>
          </div>
        )} />

      {cerrada && (
        <div className="flex items-center gap-2.5 bg-[#EAF7F0] text-[#1F9D5B] rounded-[12px] px-4 py-3 text-[13px] font-semibold">
          <CheckCircle2 size={16} />Caja de hoy cerrada con saldo {fmt(cierreHoy.saldo)}. Mañana se abre con ese saldo.
        </div>
      )}

      {!loading && !error && sinCerrar.cantidad > 0 && (
        <div className="bg-[#FBF3E2] text-[#8A5A0F] rounded-[12px] px-4 py-3 text-[13px] font-semibold">
          Hay {sinCerrar.cantidad} {sinCerrar.cantidad === 1 ? "movimiento" : "movimientos"} de días anteriores sin cerrar{ultimoCierre ? ` (último cierre: ${ultimoCierre.fecha})` : ""}. Ya están sumados en la apertura de hoy.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Apertura", value: fmt(apertura), color: "text-[#1F2421]" },
          { label: "Total ingresos", value: fmt(totalIngresos), color: "text-[#1F9D5B]" },
          { label: "Total egresos", value: fmt(totalEgresos), color: "text-[#C0506A]" },
          { label: "Saldo actual", value: fmt(saldo), color: "text-[#8A6529]" },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-[16px] shadow-card p-5">
            <p className="text-[13px] text-[#565B56]">{k.label}</p>
            <p className={cn("text-[24px] font-bold mt-2 font-[family-name:var(--font-space-grotesk)]", k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[16px] shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E9E4D8]"><h2 className="text-[15px] font-bold text-[#1F2421]">Movimientos del día</h2></div>
        {loading ? <div className="flex items-center justify-center py-16 text-[#676B63]"><Loader2 size={20} className="animate-spin mr-2" />Cargando…</div>
        : error ? <ErrorCarga mensaje={error} onReintentar={() => { setLoading(true); void cargar(); }} />
        : movs.length === 0 ? <p className="text-center py-10 text-[13px] text-[#676B63]">Todavía no hay movimientos hoy.</p>
        : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px]">
            <thead><tr className="border-b border-[#E9E4D8]">
              {["Hora", "Concepto", "Categoría", "Medio", "Monto", ""].map((h) => <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#676B63] uppercase tracking-wider">{h}</th>)}
            </tr></thead>
            <tbody>
              {movs.map((m) => (
                <tr key={m.id} className="border-b border-[#F6F3EC] hover:bg-[#F6EEDD] transition-colors">
                  <td className="px-4 py-3 text-[12px] font-mono text-[#676B63]">{m.hora.slice(0, 5)}</td>
                  <td className="px-4 py-3 text-[13px] font-semibold text-[#1F2421]">{m.concepto}</td>
                  <td className="px-4 py-3 text-[12px] text-[#565B56]">{m.categoria}</td>
                  <td className="px-4 py-3 text-[12px] text-[#565B56] capitalize">{m.medio}</td>
                  <td className="px-4 py-3"><span className={cn("text-[14px] font-bold font-[family-name:var(--font-space-grotesk)]", m.es_ingreso ? "text-[#1F9D5B]" : "text-[#C0506A]")}>{m.es_ingreso ? "+" : "−"}{fmt(m.monto)}</span></td>
                  <td className="px-4 py-3">{!cerrada && <button onClick={() => void eliminar(m)} className="p-1.5 rounded-[6px] text-[#C0506A] hover:bg-[#FBECEF]" aria-label="Eliminar"><Trash2 size={13} /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {showModal && (
        <Modal titulo="Nuevo movimiento" onClose={() => setShowModal(false)} ancho="sm:max-w-sm"
          footer={<><button onClick={() => setShowModal(false)} className={`${btnSecundario} flex-1`}>Cancelar</button>
            <button onClick={() => void agregar()} disabled={guardando} className={`${btnPrimario} flex-1`}>{guardando && <Loader2 size={14} className="animate-spin" />}Registrar</button></>}>
          <div className="flex bg-[#E9E4D8] rounded-[10px] p-1">
            {([["Ingreso", true, "#1F9D5B"], ["Egreso", false, "#C0506A"]] as const).map(([label, v, color]) => (
              <button key={label} type="button" onClick={() => setForm((f) => ({ ...f, ingreso: v }))} className="flex-1 py-2 rounded-[8px] text-[13px] font-semibold transition-colors"
                style={form.ingreso === v ? { background: color, color: "#fff" } : { color: "#676B63" }}>{label}</button>
            ))}
          </div>
          <Field label="Concepto"><input value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} className={inputCls} placeholder="Ej: Cobro alquiler MG-0023" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monto"><input type="number" inputMode="decimal" min="0" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} className={inputCls} /></Field>
            <Field label="Medio"><select value={form.medio} onChange={(e) => setForm({ ...form, medio: e.target.value as Medio })} className={inputCls}>{MEDIOS.map((m) => <option key={m} value={m} className="capitalize">{m}</option>)}</select></Field>
          </div>
          <Field label="Categoría"><select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className={inputCls}>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select></Field>
        </Modal>
      )}
    </div>
  );
}
