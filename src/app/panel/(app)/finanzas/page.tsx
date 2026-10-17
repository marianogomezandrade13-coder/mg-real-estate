"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, TrendingUp, TrendingDown, Loader2, Trash2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { PageHeader } from "@/components/panel/PageHeader";
import { Modal, Field, ErrorCarga, inputCls, btnSecundario } from "@/components/panel/ui";
import { sb, hoyISO, fechaAR } from "@/lib/panel-db";
import { dinero } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type Mov = Database["public"]["Tables"]["movimientos_finanzas"]["Row"];
type Moneda = Mov["moneda"];
type MovVista = Mov & { origen: "finanzas" | "caja" };

const CATEGORIAS = ["Alquileres", "Comisiones", "Tasaciones", "Gastos", "Otros"];
const FORM0 = { concepto: "", categoria: CATEGORIAS[0], monto: "", moneda: "ARS" as Moneda, fecha: hoyISO() };

const mesISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const ultimos6Meses = () => { const m: string[] = []; const d = new Date(); for (let i = 5; i >= 0; i--) m.push(mesISO(new Date(d.getFullYear(), d.getMonth() - i, 1))); return m; };
const etiquetaMes = (ym: string) => { const [y, m] = ym.split("-"); return new Date(Number(y), Number(m) - 1, 1).toLocaleString("es-AR", { month: "short" }).replace(".", ""); };
const variacion = (actual: number, anterior: number) => (anterior === 0 ? null : Math.round(((actual - anterior) / Math.abs(anterior)) * 100));

export default function FinanzasPage() {
  const [movs, setMovs] = useState<MovVista[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [tipoModal, setTipoModal] = useState<"ingreso" | "egreso">("ingreso");
  const [form, setForm] = useState(FORM0);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const [fin, caja] = await Promise.all([
      sb.from("movimientos_finanzas").select("*").order("fecha", { ascending: false }),
      sb.from("movimientos_caja").select("id,created_at,sucursal_id,fecha,concepto,categoria,monto,es_ingreso").order("fecha", { ascending: false }),
    ]);
    const error = fin.error ?? caja.error;
    if (error) setError(error.message);
    else {
      setError(null);
      const delaCaja: MovVista[] = (caja.data ?? []).map((c) => ({ ...c, categoria: c.categoria ?? "Otros", moneda: "ARS" as const, origen: "caja" as const }));
      const propios: MovVista[] = (fin.data ?? []).map((m) => ({ ...m, origen: "finanzas" as const }));
      setMovs([...propios, ...delaCaja].sort((a, b) => b.fecha.localeCompare(a.fecha)));
    }
    setLoading(false);
  }, []);
  useEffect(() => { const t = setTimeout(() => void cargar(), 0); return () => clearTimeout(t); }, [cargar]);

  const abrirModal = (tipo: "ingreso" | "egreso") => { setTipoModal(tipo); setForm({ ...FORM0, moneda: "ARS", fecha: hoyISO() }); setShowModal(true); };

  const kpi = useMemo(() => {
    const hoy = new Date(); const mesActual = mesISO(hoy), mesAnterior = mesISO(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1));
    const sumar = (mes: string, ingreso: boolean, moneda: Moneda) => movs.filter((m) => m.fecha.startsWith(mes) && m.es_ingreso === ingreso && m.moneda === moneda).reduce((a, m) => a + m.monto, 0);
    const ingresosARS = sumar(mesActual, true, "ARS"), egresosARS = sumar(mesActual, false, "ARS");
    const ingresosARSAnt = sumar(mesAnterior, true, "ARS"), egresosARSAnt = sumar(mesAnterior, false, "ARS");
    const netoActual = ingresosARS - egresosARS, netoAnterior = ingresosARSAnt - egresosARSAnt;
    const comisionesUSD = sumar(mesActual, true, "USD"), comisionesUSDAnt = sumar(mesAnterior, true, "USD");
    return {
      ingresosARS, egresosARS, netoActual, comisionesUSD,
      trendIngresos: variacion(ingresosARS, ingresosARSAnt), trendEgresos: variacion(egresosARS, egresosARSAnt),
      trendNeto: variacion(netoActual, netoAnterior), trendComisiones: variacion(comisionesUSD, comisionesUSDAnt),
    };
  }, [movs]);

  const grafico = useMemo(() => ultimos6Meses().map((ym) => ({
    mes: etiquetaMes(ym),
    Ingresos: movs.filter((m) => m.fecha.startsWith(ym) && m.es_ingreso && m.moneda === "ARS").reduce((a, m) => a + m.monto, 0),
    Egresos: movs.filter((m) => m.fecha.startsWith(ym) && !m.es_ingreso && m.moneda === "ARS").reduce((a, m) => a + m.monto, 0),
  })), [movs]);
  const hayDatosGrafico = grafico.some((g) => g.Ingresos > 0 || g.Egresos > 0);

  const guardar = async () => {
    if (!form.concepto.trim()) return void toast.error("Escribí el concepto");
    const monto = parseFloat(form.monto);
    if (!(monto > 0)) return void toast.error("Ingresá un monto válido");
    setGuardando(true);
    try {
      const { data, error } = await sb.from("movimientos_finanzas").insert({
        concepto: form.concepto.trim(), categoria: form.categoria, fecha: form.fecha, monto, moneda: form.moneda, es_ingreso: tipoModal === "ingreso", sucursal_id: null,
      }).select("*").single();
      if (error || !data) throw new Error(error?.message ?? "No se pudo registrar");
      setMovs((xs) => [{ ...data, origen: "finanzas" as const }, ...xs].sort((a, b) => b.fecha.localeCompare(a.fecha)));
      setShowModal(false);
      toast.success(tipoModal === "ingreso" ? "Ingreso registrado" : "Egreso registrado");
    } catch (e) { toast.error((e as Error).message); }
    finally { setGuardando(false); }
  };

  const eliminar = async (m: MovVista) => {
    if (m.origen === "caja") return void toast.info("Este movimiento viene de Caja diaria: se elimina desde allí.");
    if (!confirm(`¿Eliminar "${m.concepto}"?`)) return;
    const { error } = await sb.from("movimientos_finanzas").delete().eq("id", m.id);
    if (error) return void toast.error(error.message);
    setMovs((xs) => xs.filter((x) => x.id !== m.id));
    toast.success("Movimiento eliminado");
  };

  const trend = (v: number | null) => v == null ? <span className="text-[11px] font-semibold text-[#A3A69C] mt-1 block">sin datos del mes anterior</span> : (
    <div className="flex items-center gap-1 mt-1">
      {v >= 0 ? <TrendingUp size={12} className="text-[#1F9D5B]" /> : <TrendingDown size={12} className="text-[#C0506A]" />}
      <span className={cn("text-[11px] font-semibold", v >= 0 ? "text-[#1F9D5B]" : "text-[#C0506A]")}>{Math.abs(v)}% vs mes anterior</span>
    </div>
  );

  return (
    <div className="p-4 sm:p-7 space-y-6">
      <PageHeader title="Finanzas" subtitle="Ingresos, egresos y resultado del período · incluye los movimientos de Caja diaria (en pesos)"
        action={
          <div className="flex gap-2">
            <button onClick={() => abrirModal("ingreso")} className="flex items-center gap-2 bg-[#1F9D5B] text-white text-[13px] font-semibold px-4 py-2.5 rounded-[10px] hover:bg-[#186f40] transition-colors"><Plus size={15} /> Ingreso</button>
            <button onClick={() => abrirModal("egreso")} className="flex items-center gap-2 bg-[#C0506A] text-white text-[13px] font-semibold px-4 py-2.5 rounded-[10px] hover:bg-[#9a3f54] transition-colors"><Plus size={15} /> Egreso</button>
          </div>
        } />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Ingresos del mes (ARS)", value: dinero(kpi.ingresosARS), color: "#1F9D5B", trend: kpi.trendIngresos },
          { label: "Egresos del mes (ARS)", value: dinero(kpi.egresosARS), color: "#C0506A", trend: kpi.trendEgresos },
          { label: "Resultado neto (ARS)", value: dinero(kpi.netoActual), color: kpi.netoActual >= 0 ? "#8A6529" : "#C0506A", trend: kpi.trendNeto },
          { label: "Ingresos USD del mes", value: dinero(kpi.comisionesUSD, "USD"), color: "#3B82C4", trend: kpi.trendComisiones },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-[16px] shadow-card p-5">
            <p className="text-[13px] text-[#565B56]">{k.label}</p>
            <p className="text-[22px] sm:text-[26px] font-bold mt-2 font-[family-name:var(--font-space-grotesk)] break-words" style={{ color: k.color }}>{k.value}</p>
            {trend(k.trend)}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[16px] shadow-card p-6">
        <h2 className="text-[15px] font-bold text-[#1F2421] mb-4">Ingresos vs Egresos en pesos · últimos 6 meses</h2>
        {!loading && !hayDatosGrafico ? <p className="text-[13px] text-[#676B63] py-16 text-center">Todavía no hay movimientos en pesos para graficar.</p> : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={grafico} barCategoryGap="30%">
              <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#676B63" }} />
              <YAxis hide />
              <Tooltip formatter={(v) => dinero(Number(v))} contentStyle={{ background: "#16201B", border: "none", borderRadius: 10, color: "#fff", fontSize: 13 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Ingresos" fill="#8A6529" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Egresos" fill="#E9E4D8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white rounded-[16px] shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E9E4D8]"><h2 className="text-[15px] font-bold text-[#1F2421]">Movimientos</h2></div>
        {loading ? <div className="flex items-center justify-center py-16 text-[#676B63]"><Loader2 size={20} className="animate-spin mr-2" />Cargando…</div>
        : error ? <ErrorCarga mensaje={error} onReintentar={() => { setLoading(true); void cargar(); }} />
        : movs.length === 0 ? <p className="text-center py-10 text-[13px] text-[#676B63]">Todavía no hay movimientos registrados.</p>
        : (
          <div className="overflow-x-auto"><table className="w-full min-w-[720px]">
            <thead><tr className="border-b border-[#E9E4D8]">
              {["Concepto", "Categoría", "Origen", "Fecha", "Monto", ""].map((h) => <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#676B63] uppercase tracking-wider">{h}</th>)}
            </tr></thead>
            <tbody>
              {movs.map((m) => (
                <tr key={`${m.origen}-${m.id}`} className="border-b border-[#F6F3EC] hover:bg-[#F6EEDD] transition-colors">
                  <td className="px-4 py-3 text-[13px] font-semibold text-[#1F2421]">{m.concepto}</td>
                  <td className="px-4 py-3 text-[13px] text-[#565B56]">{m.categoria}</td>
                  <td className="px-4 py-3"><span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", m.origen === "caja" ? "bg-[#F6EEDD] text-[#8A6529]" : "bg-[#F6F3EC] text-[#676B63]")}>{m.origen === "caja" ? "Caja diaria" : "Finanzas"}</span></td>
                  <td className="px-4 py-3 text-[12px] text-[#676B63]">{fechaAR(m.fecha)}</td>
                  <td className="px-4 py-3"><span className={cn("text-[14px] font-bold font-[family-name:var(--font-space-grotesk)]", m.es_ingreso ? "text-[#1F9D5B]" : "text-[#C0506A]")}>{m.es_ingreso ? "+" : "−"}{dinero(m.monto, m.moneda)}</span></td>
                  <td className="px-4 py-3"><button onClick={() => void eliminar(m)} className="p-1.5 rounded-[6px] text-[#C0506A] hover:bg-[#FBECEF]" aria-label="Eliminar"><Trash2 size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {showModal && (
        <Modal titulo={`Nuevo ${tipoModal}`} onClose={() => setShowModal(false)} ancho="sm:max-w-sm"
          footer={<><button onClick={() => setShowModal(false)} className={`${btnSecundario} flex-1`}>Cancelar</button>
            <button onClick={() => void guardar()} disabled={guardando}
              className="flex-1 flex items-center justify-center gap-2 text-white text-[13px] font-semibold py-2.5 rounded-[10px] disabled:opacity-60" style={{ background: tipoModal === "ingreso" ? "#1F9D5B" : "#C0506A" }}>
              {guardando && <Loader2 size={14} className="animate-spin" />}Guardar
            </button></>}>
          <Field label="Concepto"><input value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} className={inputCls} placeholder="Ej: Alquileres cobrados" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monto"><input type="number" inputMode="decimal" min="0" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} className={inputCls} /></Field>
            <Field label="Moneda"><select value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value as Moneda })} className={inputCls}><option>ARS</option><option>USD</option></select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoría"><select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className={inputCls}>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Fecha"><input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className={inputCls} /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
