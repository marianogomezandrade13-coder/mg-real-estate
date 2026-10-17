"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, AlertCircle, Loader2, Receipt, FileSignature, Home, FolderOpen, KeyRound } from "lucide-react";
import { KpiCard } from "@/components/panel/dashboard/KpiCard";
import { IngresosBarchart, type PuntoBarra } from "@/components/panel/dashboard/BarChart";
import { OperacionesDonut, type Porcion } from "@/components/panel/dashboard/DonutChart";
import { ErrorCarga } from "@/components/panel/ui";
import { sb, nombreCliente, fechaAR, hoyISO, listarClientes, type Cliente } from "@/lib/panel-db";
import { dinero, proximoVencimiento, periodo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type Propiedad = Pick<Database["public"]["Tables"]["propiedades"]["Row"], "id" | "codigo" | "titulo" | "estado" | "publicada_web">;
type Alquiler = Database["public"]["Tables"]["alquileres"]["Row"];
type Recibo = Pick<Database["public"]["Tables"]["recibos"]["Row"], "id" | "total" | "moneda" | "fecha" | "concepto" | "created_at" | "cliente_id">;
type Liquidacion = Pick<Database["public"]["Tables"]["liquidaciones"]["Row"], "id" | "propiedad_id" | "periodo" | "neto" | "comision" | "estado" | "created_at">;
type Tasacion = Pick<Database["public"]["Tables"]["tasaciones"]["Row"], "id" | "direccion" | "valor_recomendado" | "created_at">;
type Documento = Pick<Database["public"]["Tables"]["documentos"]["Row"], "id" | "nombre" | "categoria" | "created_at">;

const sumarDias = (iso: string, d: number) => { const dt = new Date(`${iso}T12:00:00`); dt.setDate(dt.getDate() + d); return dt.toISOString().slice(0, 10); };
const mesAr = () => new Date().toLocaleString("es-AR", { month: "long", year: "numeric" });
const ultimos6Meses = () => { const m: string[] = []; const d = new Date(); for (let i = 5; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); m.push(x.toISOString().slice(0, 7)); } return m; };
const etiquetaMes = (ym: string) => { const [y, m] = ym.split("-"); return new Date(Number(y), Number(m) - 1, 1).toLocaleString("es-AR", { month: "short" }).replace(".", ""); };

export default function DashboardPage() {
  const [props, setProps] = useState<Propiedad[]>([]);
  const [alquileres, setAlquileres] = useState<Alquiler[]>([]);
  const [recibos, setRecibos] = useState<Recibo[]>([]);
  const [liquidaciones, setLiquidaciones] = useState<Liquidacion[]>([]);
  const [tasaciones, setTasaciones] = useState<Tasacion[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [p, a, r, l, t, d, c] = await Promise.all([
        sb.from("propiedades").select("id,codigo,titulo,estado,publicada_web"),
        sb.from("alquileres").select("*"),
        sb.from("recibos").select("id,total,moneda,fecha,concepto,created_at,cliente_id").order("created_at", { ascending: false }).limit(200),
        sb.from("liquidaciones").select("id,propiedad_id,periodo,neto,comision,estado,created_at").order("created_at", { ascending: false }).limit(100),
        sb.from("tasaciones").select("id,direccion,valor_recomendado,created_at").order("created_at", { ascending: false }).limit(100),
        sb.from("documentos").select("id,nombre,categoria,created_at").order("created_at", { ascending: false }).limit(20),
        listarClientes(),
      ]);
      const err = p.error ?? a.error ?? r.error ?? l.error ?? t.error ?? d.error;
      if (err) throw new Error(err.message);
      setError(null);
      setProps(p.data ?? []); setAlquileres(a.data ?? []); setRecibos(r.data ?? []); setLiquidaciones(l.data ?? []);
      setTasaciones(t.data ?? []); setDocumentos(d.data ?? []); setClientes(c);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const tm = setTimeout(() => void cargar(), 0); return () => clearTimeout(tm); }, [cargar]);

  const propPorId = useMemo(() => new Map(props.map((p) => [p.id, p])), [props]);
  const cliPorId = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);

  const kpi = useMemo(() => {
    const hoy = hoyISO(), mes = hoy.slice(0, 7), en30 = sumarDias(hoy, 30);
    const cobradoMes = recibos.filter((r) => r.moneda === "ARS" && r.fecha.startsWith(mes)).reduce((s, r) => s + r.total, 0);
    return {
      alquileresActivos: alquileres.length,
      mora: alquileres.filter((a) => a.estado_pago !== "al_dia").length,
      cobradoMes,
      tasacionesMes: tasaciones.filter((t) => t.created_at.startsWith(mes)).length,
      comisionesPendientes: liquidaciones.filter((l) => l.estado !== "Pagada").reduce((s, l) => s + l.comision, 0),
      liquidacionesPendientes: liquidaciones.filter((l) => l.estado === "Pendiente").length,
      propiedadesPublicadas: props.filter((p) => p.publicada_web).length,
      // También excluye los ya vencidos (proximo_ajuste < hoy): si no, un ajuste que nadie actualizó hace
      // meses queda contando para siempre como "próximo", y encima no coincide con la lista de vencimientos
      // de abajo (esa sí los excluye) — dos widgets de la misma pantalla mostrando cosas contradictorias.
      ajustesProximos: alquileres.filter((a) => a.proximo_ajuste >= hoy && a.proximo_ajuste <= en30).length,
    };
  }, [alquileres, recibos, liquidaciones, tasaciones, props]);

  const barra = useMemo((): PuntoBarra[] => {
    const meses = ultimos6Meses();
    return meses.map((ym) => ({ mes: etiquetaMes(ym), valor: recibos.filter((r) => r.fecha.startsWith(ym)).length }));
  }, [recibos]);
  const hayCobranzas = barra.some((b) => b.valor > 0);

  const donut = useMemo((): { data: Porcion[]; total: number } => {
    const colores: Record<string, string> = { Activa: "#1F9D5B", Alquilada: "#8A6529", Reservada: "#D9BC85", Vendida: "#16201B" };
    const cuenta: Record<string, number> = {};
    props.forEach((p) => { cuenta[p.estado] = (cuenta[p.estado] ?? 0) + 1; });
    const data = Object.entries(cuenta).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value, color: colores[name] ?? "#A3A69C" }));
    return { data, total: props.length };
  }, [props]);

  const vencimientos = useMemo(() => {
    const hoy = hoyISO();
    const eventos = alquileres.flatMap((a) => {
      const p = propPorId.get(a.propiedad_id);
      const etiqueta = p ? `${p.codigo} · ${p.titulo}` : "Propiedad";
      const cobro = proximoVencimiento(a.dia_vencimiento).toISOString().slice(0, 10);
      const items = [{ propiedad: etiqueta, tipo: "Cobro de alquiler", fecha: cobro }];
      if (a.proximo_ajuste >= hoy) items.push({ propiedad: etiqueta, tipo: `Ajuste de canon (${a.indice})`, fecha: a.proximo_ajuste });
      return items;
    });
    return eventos.sort((x, y) => x.fecha.localeCompare(y.fecha)).slice(0, 5);
  }, [alquileres, propPorId]);

  const actividad = useMemo(() => {
    const items = [
      ...recibos.slice(0, 8).map((r) => ({ k: `r-${r.id}`, accion: "Recibo emitido", detalle: `${nombreCliente(cliPorId.get(r.cliente_id))} · ${dinero(r.total, r.moneda as "USD" | "ARS")}`, fecha: r.created_at, icon: Receipt })),
      ...liquidaciones.filter((l) => l.estado !== "Pendiente").slice(0, 8).map((l) => ({ k: `l-${l.id}`, accion: l.estado === "Pagada" ? "Liquidación pagada" : "Liquidación aprobada", detalle: `${propPorId.get(l.propiedad_id)?.codigo ?? ""} · ${periodo(l.periodo)} · ${dinero(l.neto)}`, fecha: l.created_at, icon: FileSignature })),
      ...tasaciones.slice(0, 8).map((t) => ({ k: `t-${t.id}`, accion: "Tasación generada", detalle: `${t.direccion}${t.valor_recomendado ? ` · ${dinero(t.valor_recomendado, "USD")}` : ""}`, fecha: t.created_at, icon: Home })),
      ...documentos.slice(0, 8).map((d) => ({ k: `d-${d.id}`, accion: "Documento subido", detalle: d.nombre, fecha: d.created_at, icon: FolderOpen })),
    ];
    return items.sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 6);
  }, [recibos, liquidaciones, tasaciones, documentos, propPorId, cliPorId]);

  if (loading) return <div className="p-4 sm:p-7 flex items-center justify-center py-24 text-[#676B63]"><Loader2 size={20} className="animate-spin mr-2" />Cargando…</div>;
  if (error) return <div className="p-4 sm:p-7"><ErrorCarga mensaje={error} onReintentar={() => { setLoading(true); void cargar(); }} /></div>;

  return (
    <div className="p-4 sm:p-7 space-y-6">
      <div>
        <h1 className="text-[26px] font-bold text-[#1F2421] font-[family-name:var(--font-space-grotesk)]">Dashboard gerencial</h1>
        <p className="text-[13px] text-[#676B63] mt-0.5 capitalize">Resumen de {mesAr()} · San Martín, Mendoza</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Alquileres activos" value={String(kpi.alquileresActivos)} sub={`${kpi.mora} con deuda`} />
        <KpiCard label="Cobrado este mes" value={dinero(kpi.cobradoMes)} sub="recibos en pesos" />
        <KpiCard label="Comisiones por cobrar" value={dinero(kpi.comisionesPendientes)} sub={`${kpi.liquidacionesPendientes} liquidaciones pendientes`} />
        <KpiCard label="Propiedades publicadas" value={String(kpi.propiedadesPublicadas)} sub={`de ${props.length} en cartera`} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Con deuda" value={String(kpi.mora)} sub="contratos de alquiler" />
        <KpiCard label="Ajustes próximos" value={String(kpi.ajustesProximos)} sub="en 30 días" />
        <KpiCard label="Tasaciones del mes" value={String(kpi.tasacionesMes)} sub="generadas con IA" />
        <KpiCard label="Documentos" value={String(documentos.length)} sub="cargados recientemente" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-white rounded-[16px] shadow-card p-6">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-[16px] font-bold text-[#1F2421] font-[family-name:var(--font-space-grotesk)]">Recibos emitidos por mes</h2>
            <span className="text-[12px] text-[#A3A69C]">últimos 6 meses</span>
          </div>
          {hayCobranzas ? <IngresosBarchart data={barra} /> : <p className="text-[13px] text-[#676B63] py-16 text-center">Todavía no hay recibos emitidos.</p>}
        </div>

        <div className="lg:col-span-2 bg-white rounded-[16px] shadow-card p-6">
          <h2 className="text-[16px] font-bold text-[#1F2421] font-[family-name:var(--font-space-grotesk)] mb-5">Cartera por estado</h2>
          {donut.total > 0 ? <OperacionesDonut data={donut.data} total={donut.total} /> : <p className="text-[13px] text-[#676B63] py-10 text-center">Todavía no hay propiedades cargadas.</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-[16px] shadow-card p-6">
          <div className="flex items-center gap-2 mb-4"><CalendarDays size={16} className="text-[#8A6529]" /><h2 className="text-[15px] font-bold text-[#1F2421]">Próximos vencimientos</h2></div>
          {vencimientos.length === 0 ? <p className="text-[13px] text-[#676B63] py-6 text-center">Sin vencimientos próximos.</p> : (
            <div className="space-y-3">
              {vencimientos.map((v, i) => {
                const urgente = v.fecha <= sumarDias(hoyISO(), 7);
                return (
                  <div key={`${v.propiedad}-${v.tipo}-${i}`} className="flex items-center gap-3 py-2 border-b border-[#F6F3EC] last:border-0">
                    <div className={cn("w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0", urgente ? "bg-[#FBECEF]" : "bg-[#EAF7F0]")}>
                      <AlertCircle size={14} className={urgente ? "text-[#C0506A]" : "text-[#1F9D5B]"} />
                    </div>
                    <div className="flex-1 min-w-0"><p className="text-[13px] font-semibold text-[#1F2421] truncate">{v.propiedad}</p><p className="text-[11px] text-[#676B63]">{v.tipo}</p></div>
                    <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0", urgente ? "bg-[#FBECEF] text-[#C0506A]" : "bg-[#F6F3EC] text-[#565B56]")}>{fechaAR(v.fecha)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-[16px] shadow-card p-6">
          <div className="flex items-center gap-2 mb-4"><Clock size={16} className="text-[#8A6529]" /><h2 className="text-[15px] font-bold text-[#1F2421]">Actividad reciente</h2></div>
          {actividad.length === 0 ? <p className="text-[13px] text-[#676B63] py-6 text-center flex items-center justify-center gap-2"><KeyRound size={14} />Todavía no hay movimientos registrados.</p> : (
            <div className="space-y-3">
              {actividad.map((a) => (
                <div key={a.k} className="flex items-start gap-3 py-2 border-b border-[#F6F3EC] last:border-0">
                  <div className="w-8 h-8 rounded-[8px] bg-[#F6EEDD] flex items-center justify-center flex-shrink-0 mt-0.5"><a.icon size={14} className="text-[#8A6529]" /></div>
                  <div className="flex-1 min-w-0"><p className="text-[13px] font-semibold text-[#1F2421]">{a.accion}</p><p className="text-[11px] text-[#676B63] truncate">{a.detalle}</p></div>
                  <span className="text-[11px] text-[#A3A69C] flex-shrink-0">{fechaAR(a.fecha)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
