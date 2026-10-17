"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Phone, Mail, MessageCircle, X, Loader2, Trash2, Users } from "lucide-react";
import { PageHeader } from "@/components/panel/PageHeader";
import { Modal, Field, Vacio, ErrorCarga, inputCls, labelCls, btnPrimario, btnSecundario } from "@/components/panel/ui";
import { ClienteSelect } from "@/components/panel/ClienteSelect";
import { sb, nombreCliente, telefonoWa, listarClientes, type Cliente } from "@/lib/panel-db";
import { dinero } from "@/lib/format";
import { ETAPAS, ORIGENES, ORIGEN_COLORS, ACTIVIDADES, etapaDe, relativo, type Lead, type LeadActividad, type Etapa, type Origen } from "@/lib/panel-crm";
import { useEsTitular } from "@/lib/rol-context";
import { cn } from "@/lib/utils";

type Prop = { id: string; codigo: string; titulo: string };
type Usuario = { id: string; nombre: string };

const FORM0 = { clienteId: "", interes: "", propiedadId: "", valor: "", origen: "Web" as Origen, asignadoA: "" };

function LeadCard({ lead, cliente, onClick, onDragStart }: { lead: Lead; cliente?: Cliente; onClick: () => void; onDragStart: (e: React.DragEvent) => void }) {
  const esTitular = useEsTitular();
  return (
    <div draggable={esTitular} onDragStart={esTitular ? onDragStart : undefined} onClick={onClick}
      className={cn("bg-white rounded-[14px] p-4 shadow-card cursor-pointer hover:shadow-elevated transition-shadow border border-[#E9E4D8]", esTitular && "active:cursor-grabbing")}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: ORIGEN_COLORS[lead.origen] }}>{lead.origen}</span>
        <span className="text-[11px] text-[#A3A69C]">{relativo(lead.created_at)}</span>
      </div>
      <p className="font-semibold text-[14px] text-[#1F2421]">{lead.nombre}</p>
      {lead.interes && <p className="text-[12px] text-[#565B56] mt-0.5 line-clamp-2">{lead.interes}</p>}
      <div className="flex items-center justify-between mt-3">
        <span className="text-[13px] font-bold text-[#8A6529] font-[family-name:var(--font-space-grotesk)]">{lead.valor_estimado ? dinero(lead.valor_estimado, "USD") : ""}</span>
        {cliente?.telefono && <span className="text-[10px] text-[#A3A69C]">{cliente.telefono}</span>}
      </div>
    </div>
  );
}

function LeadDrawer({
  lead, cliente, propiedad, actividades, cargandoAct, onClose, onEtapa, onAgregarNota, onEliminar, guardandoNota,
}: {
  lead: Lead; cliente?: Cliente; propiedad?: Prop; actividades: LeadActividad[]; cargandoAct: boolean; onClose: () => void;
  onEtapa: (e: Etapa) => void; onAgregarNota: (tipo: LeadActividad["tipo"], detalle: string) => void; onEliminar: () => void; guardandoNota: boolean;
}) {
  const esTitular = useEsTitular();
  const [tipoNota, setTipoNota] = useState<LeadActividad["tipo"]>("nota");
  const [detalle, setDetalle] = useState("");
  const tel = telefonoWa(cliente?.telefono);
  const msg = `Hola ${lead.nombre.split(" ")[0]}, te contactamos de MG Real Estate por tu consulta${lead.interes ? ` sobre ${lead.interes}` : ""}.`;

  const enviarNota = () => {
    if (!detalle.trim()) return void toast.error("Escribí un detalle");
    onAgregarNota(tipoNota, detalle.trim());
    setDetalle("");
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="relative w-full sm:w-[430px] bg-white h-full flex flex-col shadow-modal overflow-y-auto">
        <div className="px-6 py-5 bg-gradient-to-r from-[#16201B] to-[#1F2C26] flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-white font-bold text-[18px] truncate">{lead.nombre}</p>
            <p className="text-[#A3A69C] text-[13px] mt-0.5 truncate">{lead.interes || "Sin interés especificado"}</p>
          </div>
          <button onClick={onClose} className="text-[#8E9389] hover:text-white transition-colors mt-0.5 shrink-0"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-6 flex-1">
          <div className="flex gap-2">
            <a href={tel ? `https://wa.me/${tel}?text=${encodeURIComponent(msg)}` : "#"} target="_blank" rel="noopener noreferrer"
              onClick={(e) => { if (!tel) { e.preventDefault(); toast.error("Este lead no tiene WhatsApp cargado"); } }}
              className={cn("flex-1 flex items-center justify-center gap-2 text-white text-[13px] font-semibold py-2.5 rounded-[10px] transition-colors", tel ? "bg-[#25D366] hover:bg-[#1da855]" : "bg-[#A3A69C] cursor-not-allowed")}>
              <MessageCircle size={14} /> WhatsApp
            </a>
            <a href={cliente?.telefono ? `tel:${cliente.telefono}` : "#"} onClick={(e) => { if (!cliente?.telefono) { e.preventDefault(); toast.error("Este lead no tiene teléfono cargado"); } }}
              className="flex-1 flex items-center justify-center gap-2 bg-[#F6F3EC] text-[#1F2421] text-[13px] font-semibold py-2.5 rounded-[10px] hover:bg-[#E9E4D8] transition-colors">
              <Phone size={14} /> Llamar
            </a>
            <a href={cliente?.email ? `mailto:${cliente.email}` : "#"} onClick={(e) => { if (!cliente?.email) { e.preventDefault(); toast.error("Este lead no tiene email cargado"); } }}
              className="flex-1 flex items-center justify-center gap-2 bg-[#F6F3EC] text-[#1F2421] text-[13px] font-semibold py-2.5 rounded-[10px] hover:bg-[#E9E4D8] transition-colors">
              <Mail size={14} /> Email
            </a>
          </div>

          <div className="space-y-3">
            <h3 className="text-[12px] font-semibold text-[#676B63] uppercase tracking-wider">Datos del lead</h3>
            {[
              ["Contacto", cliente ? `${cliente.telefono ?? "sin teléfono"} · ${cliente.email ?? "sin email"}` : "—"],
              ["Origen", lead.origen],
              ["Interés", lead.interes || "—"],
              ["Propiedad", propiedad ? `${propiedad.codigo} · ${propiedad.titulo}` : "—"],
              ["Valor estimado", lead.valor_estimado ? dinero(lead.valor_estimado, "USD") : "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 py-2 border-b border-[#F6F3EC]">
                <span className="text-[13px] text-[#676B63] shrink-0">{k}</span>
                <span className="text-[13px] font-medium text-[#1F2421] text-right">{v}</span>
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-[12px] font-semibold text-[#676B63] uppercase tracking-wider mb-3">{esTitular ? "Mover a etapa" : "Etapa"}</h3>
            <div className="flex flex-wrap gap-2">
              {ETAPAS.map((e) => {
                const activa = lead.etapa === e.id;
                if (!esTitular && !activa) return null;
                const estilo = activa ? { background: e.color, color: "#fff", borderColor: e.color } : { background: "transparent", color: e.color, borderColor: e.color + "60" };
                return esTitular ? (
                  <button key={e.id} onClick={() => onEtapa(e.id)} className="text-[12px] font-semibold px-3 py-1.5 rounded-full border transition-colors" style={estilo}>{e.label}</button>
                ) : <span key={e.id} className="text-[12px] font-semibold px-3 py-1.5 rounded-full border" style={estilo}>{e.label}</span>;
              })}
            </div>
          </div>

          <div>
            <h3 className="text-[12px] font-semibold text-[#676B63] uppercase tracking-wider mb-3">Historial</h3>
            {cargandoAct ? <Loader2 size={16} className="animate-spin text-[#8A6529]" /> : actividades.length === 0 ? (
              <p className="text-[13px] text-[#A3A69C]">Todavía no hay actividad registrada.</p>
            ) : (
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {actividades.map((a) => (
                  <div key={a.id} className="flex gap-3 text-[13px]">
                    <span className="w-16 text-[11px] font-bold text-[#8A6529] flex-shrink-0 mt-0.5 capitalize">{a.tipo}</span>
                    <div className="min-w-0"><p className="text-[#1F2421] break-words">{a.detalle}</p><p className="text-[#A3A69C] text-[11px]">{relativo(a.fecha)}</p></div>
                  </div>
                ))}
              </div>
            )}
            {esTitular && (
              <div className="mt-3 flex gap-2">
                <select value={tipoNota} onChange={(e) => setTipoNota(e.target.value as LeadActividad["tipo"])} className={cn(inputCls, "w-[110px] shrink-0")} aria-label="Tipo de actividad">
                  {ACTIVIDADES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
                <input value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Agregar una nota…" className={inputCls}
                  onKeyDown={(e) => { if (e.key === "Enter") enviarNota(); }} />
                <button onClick={enviarNota} disabled={guardandoNota} className="shrink-0 px-3 rounded-[9px] bg-[#16201B] text-[#D9BC85] text-[12px] font-semibold disabled:opacity-60">
                  {guardandoNota ? <Loader2 size={14} className="animate-spin" /> : "Agregar"}
                </button>
              </div>
            )}
          </div>

          {esTitular && <button onClick={onEliminar} className="flex items-center gap-1.5 text-[12px] font-semibold text-[#C0506A] hover:underline"><Trash2 size={13} />Eliminar lead</button>}
        </div>
      </aside>
    </div>
  );
}

export default function CrmPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [props, setProps] = useState<Prop[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [vista, setVista] = useState<"embudo" | "lista">("embudo");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actividades, setActividades] = useState<LeadActividad[]>([]);
  const [cargandoAct, setCargandoAct] = useState(false);
  const [guardandoNota, setGuardandoNota] = useState(false);

  const [showNuevo, setShowNuevo] = useState(false);
  const [form, setForm] = useState(FORM0);
  const [guardando, setGuardando] = useState(false);
  const [arrastrando, setArrastrando] = useState<Etapa | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [l, p, u, c] = await Promise.all([
        sb.from("leads").select("*").order("created_at", { ascending: false }),
        sb.from("propiedades").select("id,codigo,titulo").order("codigo"),
        sb.from("usuarios").select("id,nombre").order("nombre"),
        listarClientes(),
      ]);
      if (l.error || p.error || u.error) throw new Error(l.error?.message ?? p.error?.message ?? u.error?.message);
      setError(null); setLeads(l.data ?? []); setProps(p.data ?? []); setUsuarios(u.data ?? []); setClientes(c);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const t = setTimeout(() => void cargar(), 0); return () => clearTimeout(t); }, [cargar]);

  const cliPorId = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);
  const propPorId = useMemo(() => new Map(props.map((p) => [p.id, p])), [props]);
  const selected = useMemo(() => leads.find((l) => l.id === selectedId) ?? null, [leads, selectedId]);

  const cargarActividades = useCallback(async (leadId: string) => {
    setCargandoAct(true);
    const { data, error } = await sb.from("lead_actividades").select("*").eq("lead_id", leadId).order("fecha", { ascending: false });
    if (!error) setActividades(data ?? []);
    setCargandoAct(false);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => { if (selectedId) void cargarActividades(selectedId); else setActividades([]); }, 0);
    return () => clearTimeout(t);
  }, [selectedId, cargarActividades]);

  const crear = async () => {
    if (!form.clienteId) return void toast.error("Elegí o cargá el lead");
    setGuardando(true);
    try {
      const cliente = clientes.find((c) => c.id === form.clienteId);
      const { data, error } = await sb.from("leads").insert({
        cliente_id: form.clienteId, nombre: nombreCliente(cliente), interes: form.interes.trim() || null,
        propiedad_id: form.propiedadId || null, valor_estimado: form.valor ? parseFloat(form.valor) : null,
        origen: form.origen, etapa: "nuevo", asignado_a: form.asignadoA || null, sucursal_id: null,
      }).select("*").single();
      if (error || !data) throw new Error(error?.message ?? "No se pudo crear el lead");
      setLeads((xs) => [data, ...xs]); setShowNuevo(false); setForm(FORM0);
      toast.success("Lead creado");
    } catch (e) { toast.error((e as Error).message); }
    finally { setGuardando(false); }
  };

  const cambiarEtapa = async (lead: Lead, etapa: Etapa) => {
    if (lead.etapa === etapa) return;
    const { data, error } = await sb.from("leads").update({ etapa }).eq("id", lead.id).select("*").single();
    if (error || !data) return void toast.error(error?.message ?? "No se pudo mover el lead");
    setLeads((xs) => xs.map((x) => (x.id === lead.id ? data : x)));
    toast.success(`Movido a "${etapaDe(etapa).label}"`);
  };

  const agregarNota = async (leadId: string, tipo: LeadActividad["tipo"], detalle: string) => {
    setGuardandoNota(true);
    const { data, error } = await sb.from("lead_actividades").insert({ lead_id: leadId, tipo, detalle, fecha: new Date().toISOString() }).select("*").single();
    setGuardandoNota(false);
    if (error || !data) return void toast.error(error?.message ?? "No se pudo guardar");
    setActividades((xs) => [data, ...xs]);
  };

  const eliminar = async (lead: Lead) => {
    if (!confirm(`¿Eliminar el lead de ${lead.nombre}? También se borra su historial.`)) return;
    await sb.from("lead_actividades").delete().eq("lead_id", lead.id);
    const { error } = await sb.from("leads").delete().eq("id", lead.id);
    if (error) return void toast.error(error.message);
    setLeads((xs) => xs.filter((x) => x.id !== lead.id)); setSelectedId(null);
    toast.success("Lead eliminado");
  };

  const esTitular = useEsTitular();

  const soltar = (etapa: Etapa) => (e: React.DragEvent) => {
    e.preventDefault(); setArrastrando(null);
    const id = e.dataTransfer.getData("text/plain");
    const lead = leads.find((l) => l.id === id);
    if (lead) void cambiarEtapa(lead, etapa);
  };

  return (
    <div className="p-4 sm:p-7">
      <PageHeader title="CRM · Embudo comercial" subtitle="Gestión de leads y oportunidades"
        action={esTitular && <button onClick={() => setShowNuevo(true)} className={btnPrimario}><Plus size={15} /> Nuevo lead</button>} />

      {!loading && !error && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6">
          <div className="flex bg-[#E9E4D8] rounded-[10px] p-1 w-fit">
            {(["embudo", "lista"] as const).map((v) => (
              <button key={v} onClick={() => setVista(v)} className={cn("px-4 py-1.5 rounded-[8px] text-[13px] font-semibold capitalize transition-colors", vista === v ? "bg-white text-[#1F2421] shadow-sm" : "text-[#676B63] hover:text-[#1F2421]")}>
                {v === "embudo" ? "Embudo" : "Lista"}
              </button>
            ))}
          </div>
          <p className="text-[13px] text-[#676B63]">{leads.length} lead{leads.length === 1 ? "" : "s"}{vista === "embudo" && esTitular ? " · arrastrá las tarjetas entre columnas" : ""}</p>
        </div>
      )}

      {loading ? <div className="flex items-center justify-center py-20 text-[#676B63]"><Loader2 size={20} className="animate-spin mr-2" />Cargando…</div>
      : error ? <ErrorCarga mensaje={error} onReintentar={() => { setLoading(true); void cargar(); }} />
      : leads.length === 0 ? (
        <Vacio icono={<Users size={24} />} titulo="Todavía no hay leads cargados" texto="Cada consulta que recibas por WhatsApp, la web o un portal la registrás acá y la vas moviendo por el embudo hasta cerrarla."
          accion={esTitular ? <button onClick={() => setShowNuevo(true)} className={btnPrimario}>Cargar el primero</button> : undefined} />
      ) : vista === "embudo" ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {ETAPAS.map((etapa) => {
            const etapaLeads = leads.filter((l) => l.etapa === etapa.id);
            return (
              <div key={etapa.id} className="flex-shrink-0 w-[240px]"
                onDragOver={esTitular ? (e) => { e.preventDefault(); setArrastrando(etapa.id); } : undefined}
                onDragLeave={esTitular ? () => setArrastrando(null) : undefined} onDrop={esTitular ? soltar(etapa.id) : undefined}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full" style={{ background: etapa.color }} />
                  <span className="text-[13px] font-semibold text-[#1F2421]">{etapa.label}</span>
                  <span className="ml-auto text-[12px] text-[#A3A69C] font-bold">{etapaLeads.length}</span>
                </div>
                <div className={cn("space-y-3 min-h-[120px] rounded-[12px] p-2 transition-colors", arrastrando === etapa.id ? "bg-[#8A6529]/15" : "bg-[#E9E4D8]/40")}>
                  {etapaLeads.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} cliente={lead.cliente_id ? cliPorId.get(lead.cliente_id) : undefined} onClick={() => setSelectedId(lead.id)}
                      onDragStart={(e) => { e.dataTransfer.setData("text/plain", lead.id); e.dataTransfer.effectAllowed = "move"; }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-[16px] shadow-card overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full min-w-[640px]">
            <thead><tr className="border-b border-[#E9E4D8]">
              {["Nombre", "Interés", "Valor est.", "Origen", "Etapa", "Cuándo"].map((h) => <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#676B63] uppercase tracking-wider">{h}</th>)}
            </tr></thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} onClick={() => setSelectedId(lead.id)} className="border-b border-[#F6F3EC] hover:bg-[#F6EEDD] cursor-pointer transition-colors">
                  <td className="px-4 py-3 text-[13px] font-semibold text-[#1F2421]">{lead.nombre}</td>
                  <td className="px-4 py-3 text-[13px] text-[#565B56] max-w-[220px] truncate">{lead.interes || "—"}</td>
                  <td className="px-4 py-3 text-[13px] font-bold text-[#8A6529] font-[family-name:var(--font-space-grotesk)]">{lead.valor_estimado ? dinero(lead.valor_estimado, "USD") : "—"}</td>
                  <td className="px-4 py-3"><span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: ORIGEN_COLORS[lead.origen] }}>{lead.origen}</span></td>
                  <td className="px-4 py-3"><span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: etapaDe(lead.etapa).color + "20", color: etapaDe(lead.etapa).color }}>{etapaDe(lead.etapa).label}</span></td>
                  <td className="px-4 py-3 text-[12px] text-[#A3A69C]">{relativo(lead.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {selected && (
        <LeadDrawer lead={selected} cliente={selected.cliente_id ? cliPorId.get(selected.cliente_id) : undefined} propiedad={selected.propiedad_id ? propPorId.get(selected.propiedad_id) : undefined}
          actividades={actividades} cargandoAct={cargandoAct} guardandoNota={guardandoNota} onClose={() => setSelectedId(null)}
          onEtapa={(e) => void cambiarEtapa(selected, e)} onAgregarNota={(t, d) => void agregarNota(selected.id, t, d)} onEliminar={() => void eliminar(selected)} />
      )}

      {showNuevo && (
        <Modal titulo="Nuevo lead" onClose={() => setShowNuevo(false)} ancho="sm:max-w-md"
          footer={<><button onClick={() => setShowNuevo(false)} className={`${btnSecundario} flex-1`}>Cancelar</button>
            <button onClick={() => void crear()} disabled={guardando} className={`${btnPrimario} flex-1`}>{guardando && <Loader2 size={14} className="animate-spin" />}Crear lead</button></>}>
          <Field label="Persona">
            <ClienteSelect value={form.clienteId} onChange={(id) => setForm({ ...form, clienteId: id })} clientes={clientes} onCreado={(c) => setClientes((cs) => [...cs, c])}
              tipos={["lead", "propietario", "inquilino", "otro"]} tipoNuevo="lead" placeholder="Elegí o cargá a la persona" />
          </Field>
          <Field label="Interés (propiedad, zona, tipo de operación)"><input value={form.interes} onChange={(e) => setForm({ ...form, interes: e.target.value })} className={inputCls} placeholder="Ej: Casa 3 dormitorios en Chacras de Coria" /></Field>
          {props.length > 0 && (
            <Field label="Propiedad puntual (opcional)">
              <select value={form.propiedadId} onChange={(e) => setForm({ ...form, propiedadId: e.target.value })} className={inputCls}>
                <option value="">Sin vincular</option>
                {props.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.titulo}</option>)}
              </select>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor estimado (USD)"><input type="number" inputMode="decimal" min="0" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className={inputCls} /></Field>
            <Field label="Origen"><select value={form.origen} onChange={(e) => setForm({ ...form, origen: e.target.value as Origen })} className={inputCls}>{ORIGENES.map((o) => <option key={o}>{o}</option>)}</select></Field>
          </div>
          {usuarios.length > 0 && (
            <div>
              <label className={labelCls}>Asignado a (opcional)</label>
              <select value={form.asignadoA} onChange={(e) => setForm({ ...form, asignadoA: e.target.value })} className={inputCls}>
                <option value="">Sin asignar</option>
                {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
