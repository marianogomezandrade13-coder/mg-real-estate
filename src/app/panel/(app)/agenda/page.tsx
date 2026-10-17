"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Loader2, Trash2, MapPin, MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/panel/PageHeader";
import { Modal, Field, ErrorCarga, inputCls, btnPrimario, btnSecundario } from "@/components/panel/ui";
import { sb, nombreCliente, hoyISO, telefonoWa, listarClientes, type Cliente } from "@/lib/panel-db";
import { useEsTitular } from "@/lib/rol-context";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type Evento = Database["public"]["Tables"]["eventos_agenda"]["Row"];
type Tipo = Evento["tipo"];
type Prop = { id: string; codigo: string; titulo: string };

const TIPOS: { id: Tipo; label: string; color: string }[] = [
  { id: "visita", label: "Visita", color: "#3B82C4" }, { id: "cobro", label: "Cobro", color: "#1F9D5B" },
  { id: "renovacion", label: "Renovación", color: "#E0A93B" }, { id: "reunion", label: "Reunión", color: "#8A6529" },
];
const colorDe = (t: Tipo) => TIPOS.find((x) => x.id === t)?.color ?? "#676B63";
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS_SEM = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Form = { id?: string; titulo: string; fecha: string; hora: string; tipo: Tipo; propiedadId: string; clienteId: string };
const formVacio = (fecha: string): Form => ({ titulo: "", fecha, hora: "10:00", tipo: "visita", propiedadId: "", clienteId: "" });

export default function AgendaPage() {
  const esTitular = useEsTitular();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [props, setProps] = useState<Prop[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth());
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [form, setForm] = useState<Form | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [diaAbierto, setDiaAbierto] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      // listarClientes() ahora lanza si falla: sin el try/catch, un error ahí dejaba la pantalla
      // "Cargando…" para siempre (Promise.all rechazado sin manejar) en vez de mostrar el error.
      const [e, p, c] = await Promise.all([
        sb.from("eventos_agenda").select("*").order("fecha").order("hora"),
        sb.from("propiedades").select("id,codigo,titulo").order("codigo"),
        listarClientes(),
      ]);
      if (e.error || p.error) throw new Error(e.error?.message ?? p.error?.message);
      setError(null); setEventos(e.data ?? []); setProps(p.data ?? []); setClientes(c);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const t = setTimeout(() => void cargar(), 0); return () => clearTimeout(t); }, [cargar]);

  const propPorId = useMemo(() => new Map(props.map((p) => [p.id, p])), [props]);
  const cliPorId = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);
  const porDia = useMemo(() => { const m = new Map<string, Evento[]>(); eventos.forEach((e) => m.set(e.fecha, [...(m.get(e.fecha) ?? []), e])); return m; }, [eventos]);

  const primerDia = new Date(anio, mes, 1).getDay();
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const prev = () => { if (mes === 0) { setMes(11); setAnio((a) => a - 1); } else setMes((m) => m - 1); };
  const next = () => { if (mes === 11) { setMes(0); setAnio((a) => a + 1); } else setMes((m) => m + 1); };

  const guardar = async () => {
    if (!form) return;
    if (!form.titulo.trim()) return void toast.error("Escribí un título");
    if (!form.fecha) return void toast.error("Elegí la fecha");
    setGuardando(true);
    try {
      const fila = { titulo: form.titulo.trim(), fecha: form.fecha, hora: form.hora || "09:00", tipo: form.tipo, propiedad_id: form.propiedadId || null, cliente_id: form.clienteId || null, google_event_id: null, sucursal_id: null };
      if (form.id) {
        const { data, error } = await sb.from("eventos_agenda").update(fila).eq("id", form.id).select("*").single();
        if (error || !data) throw new Error(error?.message ?? "No se pudo guardar");
        setEventos((xs) => xs.map((x) => (x.id === form.id ? data : x)));
      } else {
        const { data, error } = await sb.from("eventos_agenda").insert(fila).select("*").single();
        if (error || !data) throw new Error(error?.message ?? "No se pudo crear");
        setEventos((xs) => [...xs, data]);
      }
      setForm(null);
      toast.success(form.id ? "Evento actualizado" : "Evento creado");
    } catch (e) { toast.error((e as Error).message); }
    finally { setGuardando(false); }
  };

  const eliminar = async (ev: Evento) => {
    if (!confirm(`¿Eliminar "${ev.titulo}"?`)) return;
    const { error } = await sb.from("eventos_agenda").delete().eq("id", ev.id);
    if (error) return void toast.error(error.message);
    setEventos((xs) => xs.filter((x) => x.id !== ev.id)); setForm(null);
    toast.success("Evento eliminado");
  };

  const abrirEdicion = (ev: Evento) => setForm({ id: ev.id, titulo: ev.titulo, fecha: ev.fecha, hora: ev.hora.slice(0, 5), tipo: ev.tipo, propiedadId: ev.propiedad_id ?? "", clienteId: ev.cliente_id ?? "" });

  const eventosDia = diaAbierto ? (porDia.get(diaAbierto) ?? []) : [];

  return (
    <div className="p-4 sm:p-7 space-y-6">
      <PageHeader title="Agenda" subtitle="Visitas, cobros, renovaciones y reuniones"
        action={esTitular && <button onClick={() => setForm(formVacio(hoyISO()))} className={btnPrimario}><Plus size={15} /> Evento</button>} />

      <div className="bg-white rounded-[16px] shadow-card p-4 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[18px] font-bold text-[#1F2421] font-[family-name:var(--font-space-grotesk)]">{MESES[mes]} {anio}</h2>
          <div className="flex gap-2">
            <button onClick={prev} aria-label="Mes anterior" className="w-9 h-9 rounded-[9px] bg-[#F6F3EC] flex items-center justify-center hover:bg-[#E9E4D8] transition-colors"><ChevronLeft size={16} /></button>
            <button onClick={next} aria-label="Mes siguiente" className="w-9 h-9 rounded-[9px] bg-[#F6F3EC] flex items-center justify-center hover:bg-[#E9E4D8] transition-colors"><ChevronRight size={16} /></button>
          </div>
        </div>

        <div className="flex gap-4 mb-4 flex-wrap">
          {TIPOS.map((t) => (
            <div key={t.id} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} /><span className="text-[12px] text-[#565B56]">{t.label}</span></div>
          ))}
        </div>

        {loading ? <div className="flex items-center justify-center py-16 text-[#676B63]"><Loader2 size={20} className="animate-spin mr-2" />Cargando…</div>
        : error ? <ErrorCarga mensaje={error} onReintentar={() => { setLoading(true); void cargar(); }} />
        : (
          <div className="grid grid-cols-7 gap-1">
            {DIAS_SEM.map((d) => <div key={d} className="text-center text-[11px] font-semibold text-[#676B63] py-2">{d}</div>)}
            {Array.from({ length: primerDia }).map((_, i) => <div key={`empty-${i}`} />)}
            {Array.from({ length: diasEnMes }, (_, i) => i + 1).map((dia) => {
              const fecha = ymd(new Date(anio, mes, dia));
              const evs = porDia.get(fecha) ?? [];
              const esHoy = mes === hoy.getMonth() && anio === hoy.getFullYear() && dia === hoy.getDate();
              return (
                <button key={dia} onClick={() => (evs.length ? setDiaAbierto(fecha) : esTitular && setForm(formVacio(fecha)))} disabled={!evs.length && !esTitular}
                  className={cn("min-h-[80px] rounded-[10px] p-1.5 border text-left transition-colors", esHoy ? "border-[#8A6529] bg-[#F6EEDD]" : "border-transparent hover:bg-[#F6F3EC] disabled:hover:bg-transparent")}>
                  <span className={cn("text-[13px] font-semibold block mb-1", esHoy ? "text-[#8A6529]" : "text-[#1F2421]")}>{dia}</span>
                  {evs.slice(0, 3).map((ev) => (
                    <div key={ev.id} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] text-white mb-0.5 truncate" style={{ background: colorDe(ev.tipo) }}>{ev.hora.slice(0, 5)} {ev.titulo}</div>
                  ))}
                  {evs.length > 3 && <div className="text-[10px] font-semibold text-[#8A6529]">+{evs.length - 3} más</div>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {diaAbierto && (
        <Modal titulo={new Date(`${diaAbierto}T12:00:00`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })} onClose={() => setDiaAbierto(null)}
          footer={esTitular ? <button onClick={() => { const f = diaAbierto; setDiaAbierto(null); setForm(formVacio(f)); }} className={`${btnPrimario} w-full`}><Plus size={15} />Agregar evento este día</button> : undefined}>
          {eventosDia.length === 0 ? <p className="text-[13px] text-[#676B63] text-center py-4">Sin eventos este día.</p> : (
            <div className="space-y-2">
              {eventosDia.map((ev) => {
                const cliente = ev.cliente_id ? cliPorId.get(ev.cliente_id) : undefined;
                const tel = telefonoWa(cliente?.telefono);
                return (
                  <div key={ev.id} className={cn("p-3 rounded-[10px] border border-[#E9E4D8]", esTitular && "hover:bg-[#F6F3EC] cursor-pointer")} onClick={esTitular ? () => { setDiaAbierto(null); abrirEdicion(ev); } : undefined}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white shrink-0" style={{ background: colorDe(ev.tipo) }}>{ev.hora.slice(0, 5)}</span>
                      <span className="text-[13px] font-semibold text-[#1F2421] flex-1 truncate">{ev.titulo}</span>
                      {tel && (
                        <a href={`https://wa.me/${tel}?text=${encodeURIComponent(`Hola, te recuerdo: ${ev.titulo} el ${diaAbierto} a las ${ev.hora.slice(0, 5)}.`)}`}
                          onClick={(e) => e.stopPropagation()} target="_blank" rel="noopener noreferrer" className="text-[#1F9D5B] shrink-0" aria-label="WhatsApp"><MessageCircle size={15} /></a>
                      )}
                    </div>
                    {(ev.propiedad_id || ev.cliente_id) && (
                      <p className="text-[11px] text-[#676B63] mt-1 flex items-center gap-1">
                        {ev.propiedad_id && <><MapPin size={11} />{propPorId.get(ev.propiedad_id)?.codigo}</>}
                        {ev.propiedad_id && ev.cliente_id && " · "}
                        {cliente && nombreCliente(cliente)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Modal>
      )}

      {form && (
        <Modal titulo={form.id ? "Editar evento" : "Nuevo evento"} onClose={() => setForm(null)} ancho="sm:max-w-sm"
          footer={<>
            {form.id && <button onClick={() => void eliminar(eventos.find((e) => e.id === form.id)!)} className="p-2.5 rounded-[10px] text-[#C0506A] hover:bg-[#FBECEF]" aria-label="Eliminar"><Trash2 size={16} /></button>}
            <button onClick={() => setForm(null)} className={`${btnSecundario} flex-1`}>Cancelar</button>
            <button onClick={() => void guardar()} disabled={guardando} className={`${btnPrimario} flex-1`}>{guardando && <Loader2 size={14} className="animate-spin" />}Guardar</button>
          </>}>
          <Field label="Título"><input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className={inputCls} placeholder="Ej: Visita con Lucía Fernández" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Día"><input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className={inputCls} /></Field>
            <Field label="Hora"><input type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} className={inputCls} /></Field>
          </div>
          <Field label="Tipo"><select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as Tipo })} className={inputCls}>{TIPOS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></Field>
          {props.length > 0 && (
            <Field label="Propiedad (opcional)"><select value={form.propiedadId} onChange={(e) => setForm({ ...form, propiedadId: e.target.value })} className={inputCls}>
              <option value="">Sin vincular</option>{props.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.titulo}</option>)}
            </select></Field>
          )}
          {clientes.length > 0 && (
            <Field label="Cliente (opcional)"><select value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })} className={inputCls}>
              <option value="">Sin vincular</option>{clientes.map((c) => <option key={c.id} value={c.id}>{nombreCliente(c)}</option>)}
            </select></Field>
          )}
        </Modal>
      )}
    </div>
  );
}
