"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2, Trash2, Home, MessageCircle, Check } from "lucide-react";
import { PageHeader } from "@/components/panel/PageHeader";
import { Modal, Field, Kpi, Vacio, ErrorCarga, inputCls, btnPrimario, btnSecundario } from "@/components/panel/ui";
import { ClienteSelect } from "@/components/panel/ClienteSelect";
import { sb, nombreCliente, telefonoWa, listarClientes, type Cliente } from "@/lib/panel-db";
import { dinero } from "@/lib/format";
import { revalidarSitioPublico } from "@/lib/revalidar";
import { useEsTitular } from "@/lib/rol-context";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type Captacion = Database["public"]["Tables"]["captaciones"]["Row"];
type Etapa = Captacion["etapa"];
type TipoProp = Database["public"]["Tables"]["propiedades"]["Row"]["tipo"];

const TIPOS: TipoProp[] = ["Casa", "Departamento", "PH", "Finca", "Oficina", "Local", "Lote"];
const ETAPAS: { id: Etapa; label: string }[] = [
  { id: "Pendiente", label: "Contacto" }, { id: "Tasando", label: "Tasación" }, { id: "Negociando", label: "Negociación" },
  { id: "Autorizada", label: "Autorización" }, { id: "Publicada", label: "Publicada" },
];
const idxEtapa = (e: Etapa) => ETAPAS.findIndex((x) => x.id === e);

const FORM0 = { clienteId: "", direccion: "", tipo: "Casa" as TipoProp, operacion: "Venta" as Captacion["operacion"], valor: "", proximaAccion: "" };

async function siguienteCodigo() {
  const { data } = await sb.from("propiedades").select("codigo").like("codigo", "MG-%").order("codigo", { ascending: false }).limit(1);
  const n = data?.[0] ? parseInt(data[0].codigo.replace(/\D/g, ""), 10) || 0 : 0;
  return `MG-${String(n + 1).padStart(4, "0")}`;
}

export default function CaptacionPage() {
  const [captaciones, setCaptaciones] = useState<Captacion[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showNuevo, setShowNuevo] = useState(false);
  const [form, setForm] = useState(FORM0);
  const [guardando, setGuardando] = useState(false);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [accionEdit, setAccionEdit] = useState<{ id: string; texto: string } | null>(null);
  const [prospectosCantidad, setProspectosCantidad] = useState<number | null>(null);

  // Puente con la extensión de Chrome "MG Comparables": si está instalada, avisa cuántos prospectos de
  // captación (propiedades relevadas en portales para ir a ofrecerles el servicio) tiene guardados.
  useEffect(() => {
    type ProspectoExt = { id: string; portal: string; direccion: string | null; precio: number | null; moneda: string | null; operacion: string | null; tipoGuess: string | null; link: string };
    const onReady = (e: Event) => setProspectosCantidad((e as CustomEvent<{ cantidad: number }>).detail?.cantidad ?? 0);
    const onDatos = (e: Event) => {
      const items = (e as CustomEvent<ProspectoExt[]>).detail ?? [];
      const it = items[0];
      if (!it) return;
      const tipo = (TIPOS as string[]).includes(it.tipoGuess ?? "") ? (it.tipoGuess as TipoProp) : "Casa";
      const operacion: Captacion["operacion"] = it.operacion === "alquiler" || it.operacion === "alquiler_temporal" ? "Alquiler" : "Venta";
      setForm({
        clienteId: "", direccion: it.direccion ?? "", tipo, operacion,
        valor: it.moneda === "USD" && it.precio ? String(Math.round(it.precio)) : "",
        proximaAccion: `Visto en ${it.portal}${it.link ? `: ${it.link}` : ""}`,
      });
      setShowNuevo(true);
      window.dispatchEvent(new CustomEvent("mg-extension-prospectos-marcar-usados", { detail: [it.id] }));
      if (items.length > 1) toast.message(`Quedan ${items.length - 1} prospecto(s) más en la extensión: importalos de a uno después de cargar este.`);
    };
    window.addEventListener("mg-extension-prospectos-ready", onReady);
    window.addEventListener("mg-extension-prospectos-datos", onDatos);
    return () => {
      window.removeEventListener("mg-extension-prospectos-ready", onReady);
      window.removeEventListener("mg-extension-prospectos-datos", onDatos);
    };
  }, []);
  const importarProspecto = () => window.dispatchEvent(new Event("mg-extension-prospectos-pedir"));

  const cargar = useCallback(async () => {
    try {
      const [c, cl] = await Promise.all([sb.from("captaciones").select("*").order("created_at", { ascending: false }), listarClientes()]);
      if (c.error) throw new Error(c.error.message);
      setError(null); setCaptaciones(c.data ?? []); setClientes(cl);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const t = setTimeout(() => void cargar(), 0); return () => clearTimeout(t); }, [cargar]);

  const cliPorId = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);
  const reemplazar = (c: Captacion) => setCaptaciones((xs) => xs.map((x) => (x.id === c.id ? c : x)));

  const kpi = useMemo(() => {
    const enProceso = captaciones.filter((c) => c.etapa !== "Publicada").length;
    const autorizadas = captaciones.filter((c) => c.etapa === "Autorizada").length;
    const publicadas = captaciones.filter((c) => c.etapa === "Publicada");
    // La tabla no guarda cuándo pasó a "Publicada" (solo cuándo se CARGÓ la captación), así que no se puede
    // saber cuántas se publicaron este mes calendario sin arriesgar un número falso — se muestra el total.
    const conversion = captaciones.length ? Math.round((publicadas.length / captaciones.length) * 100) : null;
    return { enProceso, autorizadas, publicadasTotal: publicadas.length, conversion };
  }, [captaciones]);

  const crear = async () => {
    if (!form.clienteId) return void toast.error("Elegí al propietario");
    if (!form.direccion.trim()) return void toast.error("Ingresá la dirección");
    setGuardando(true);
    try {
      const { data, error } = await sb.from("captaciones").insert({
        cliente_id: form.clienteId, direccion: form.direccion.trim(), tipo: form.tipo, operacion: form.operacion,
        valor_pretendido: form.valor ? parseFloat(form.valor) : null, etapa: "Pendiente", proxima_accion: form.proximaAccion.trim() || null, sucursal_id: null,
      }).select("*").single();
      if (error || !data) throw new Error(error?.message ?? "No se pudo crear la captación");
      setCaptaciones((xs) => [data, ...xs]); setShowNuevo(false); setForm(FORM0);
      toast.success("Captación registrada");
    } catch (e) { toast.error((e as Error).message); }
    finally { setGuardando(false); }
  };

  const cambiarEtapa = async (c: Captacion, etapa: Etapa) => {
    const { data, error } = await sb.from("captaciones").update({ etapa }).eq("id", c.id).select("*").single();
    if (error || !data) return void toast.error(error?.message ?? "No se pudo actualizar");
    reemplazar(data);
  };

  const guardarAccion = async () => {
    if (!accionEdit) return;
    const { data, error } = await sb.from("captaciones").update({ proxima_accion: accionEdit.texto.trim() || null }).eq("id", accionEdit.id).select("*").single();
    if (error || !data) return void toast.error(error?.message ?? "No se pudo guardar");
    reemplazar(data); setAccionEdit(null);
  };

  const eliminar = async (c: Captacion) => {
    if (!confirm(`¿Eliminar la captación de ${c.direccion}?`)) return;
    const { error } = await sb.from("captaciones").delete().eq("id", c.id);
    if (error) return void toast.error(error.message);
    setCaptaciones((xs) => xs.filter((x) => x.id !== c.id));
    toast.success("Captación eliminada");
  };

  const crearPropiedad = async (c: Captacion) => {
    setTrabajando(c.id);
    try {
      const codigo = await siguienteCodigo();
      const cliente = cliPorId.get(c.cliente_id);
      const { error } = await sb.from("propiedades").insert({
        codigo, titulo: `${c.tipo} en ${c.direccion}`, tipo: (TIPOS.includes(c.tipo as TipoProp) ? c.tipo : "Casa") as TipoProp, operacion: c.operacion,
        precio: c.valor_pretendido ?? 0, moneda: "USD", direccion: c.direccion, barrio: null, ciudad: null, provincia: "Mendoza", lat: null, lng: null,
        ambientes: null, dormitorios: null, banos: null, cocheras: null, m2_cubiertos: null, m2_totales: null, antiguedad: null,
        estado_conservacion: null, patio: null, expensas: null, descripcion: null, estado: "Activa", publicada_web: false,
        propietario_id: c.cliente_id, servicios: null, sucursal_id: null,
      }).select("id").single();
      if (error) throw new Error(error.message);
      const upd = await sb.from("captaciones").update({ etapa: "Publicada" }).eq("id", c.id).select("*").single();
      if (upd.error || !upd.data) {
        // La propiedad YA se creó (arriba): no se puede deshacer sin arriesgar perder la carga; se avisa
        // en vez de fallar en silencio, para que no se reintente y se genere una propiedad duplicada.
        toast.warning(`Propiedad ${codigo} creada, pero no se pudo actualizar la etapa de la captación. Movela a mano a "Publicada" — no vuelvas a tocar "Crear propiedad" para esta captación.`);
      } else {
        reemplazar(upd.data);
        toast.success(`Propiedad ${codigo} creada para ${nombreCliente(cliente)}. Terminá de cargarla en Propiedades (fotos, descripción) antes de publicarla en la web.`);
      }
      void revalidarSitioPublico().catch(() => {});
    } catch (e) { toast.error("No se pudo crear la propiedad: " + (e as Error).message); }
    finally { setTrabajando(null); }
  };

  const esTitular = useEsTitular();

  return (
    <div className="p-4 sm:p-7 space-y-6">
      <PageHeader title="Captación" subtitle="Pipeline de propiedades en proceso de captación"
        action={esTitular && <button onClick={() => setShowNuevo(true)} className={btnPrimario}><Plus size={15} /> Nueva captación</button>} />

      {esTitular && prospectosCantidad !== null && prospectosCantidad > 0 && (
        <button onClick={importarProspecto}
          className="w-full flex items-center justify-center gap-2 h-11 bg-forest text-gold-light text-[13px] font-bold rounded-[10px] hover:bg-forest-3 transition-colors">
          <Home size={15} />Importar prospecto de la extensión MG Comparables ({prospectosCantidad} en espera)
        </button>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="En proceso" value={String(kpi.enProceso)} sub="propiedades captando" />
        <Kpi label="Autorizadas" value={String(kpi.autorizadas)} sub="listas para publicar" color="text-[#8A5A0F]" />
        <Kpi label="Publicadas" value={String(kpi.publicadasTotal)} sub="total en cartera" color="text-[#1F9D5B]" />
        <Kpi label="Tasa de conversión" value={kpi.conversion == null ? "—" : `${kpi.conversion}%`} sub="captación → publicada" />
      </div>

      {loading ? <div className="flex items-center justify-center py-20 text-[#676B63]"><Loader2 size={20} className="animate-spin mr-2" />Cargando…</div>
      : error ? <ErrorCarga mensaje={error} onReintentar={() => { setLoading(true); void cargar(); }} />
      : captaciones.length === 0 ? (
        <Vacio icono={<Home size={24} />} titulo="Todavía no hay captaciones en proceso" texto="Cargá cada propiedad que estás gestionando con un propietario, desde el primer contacto hasta que queda publicada."
          accion={esTitular ? <button onClick={() => setShowNuevo(true)} className={btnPrimario}>Cargar la primera</button> : undefined} />
      ) : (
        <div className="space-y-4">
          {captaciones.map((c) => {
            const cliente = cliPorId.get(c.cliente_id);
            const tel = telefonoWa(cliente?.telefono);
            const i = idxEtapa(c.etapa);
            return (
              <div key={c.id} className="bg-white rounded-[16px] shadow-card p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-[#1F2421] truncate">{nombreCliente(cliente)}</p>
                    <p className="text-[13px] text-[#565B56] truncate">{c.tipo} · {c.direccion}</p>
                    <p className="text-[13px] text-[#A3A69C]">{c.operacion} · <span className="font-semibold text-[#8A6529]">{c.valor_pretendido ? dinero(c.valor_pretendido, "USD") : "sin valor"}</span></p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {tel && (
                      <a href={`https://wa.me/${tel}?text=${encodeURIComponent(`Hola ${cliente?.nombre ?? ""}, le contactamos de MG Real Estate por su propiedad en ${c.direccion}.`)}`}
                        target="_blank" rel="noopener noreferrer" className="bg-[#25D366] text-white text-[12px] font-semibold px-3 py-1.5 rounded-[8px] hover:bg-[#1da855] inline-flex items-center gap-1.5">
                        <MessageCircle size={13} />WhatsApp
                      </a>
                    )}
                    {esTitular && c.etapa !== "Publicada" && (i >= idxEtapa("Autorizada")) && (
                      <button onClick={() => void crearPropiedad(c)} disabled={trabajando === c.id}
                        className="bg-[#16201B] text-[#D9BC85] text-[12px] font-semibold px-3 py-1.5 rounded-[8px] hover:bg-[#1F2C26] inline-flex items-center gap-1.5 disabled:opacity-60">
                        {trabajando === c.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}Crear propiedad
                      </button>
                    )}
                    {esTitular && <button onClick={() => void eliminar(c)} className="p-1.5 rounded-[8px] text-[#C0506A] hover:bg-[#FBECEF]" title="Eliminar" aria-label="Eliminar"><Trash2 size={14} /></button>}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    {ETAPAS.map((etapa, j) => {
                      const clsPaso = cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0", j <= i ? "bg-[#8A6529] text-white" : "bg-[#E9E4D8] text-[#A3A69C]");
                      return (
                        <div key={etapa.id} className="flex items-center gap-1 flex-1 last:flex-none">
                          {esTitular ? (
                            <button onClick={() => void cambiarEtapa(c, etapa.id)} title={`Marcar "${etapa.label}"`} className={cn(clsPaso, "transition-colors hover:bg-[#D9BC85]")}>{j + 1}</button>
                          ) : <span className={clsPaso}>{j + 1}</span>}
                          {j < ETAPAS.length - 1 && <div className={cn("h-0.5 flex-1 transition-colors", j < i ? "bg-[#8A6529]" : "bg-[#E9E4D8]")} />}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between">
                    {ETAPAS.map((etapa, j) => <span key={etapa.id} className={cn("text-[10px] font-semibold", j === i ? "text-[#8A6529]" : "text-[#A3A69C]")}>{etapa.label}</span>)}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#F6F3EC]">
                  {accionEdit?.id === c.id ? (
                    <div className="flex gap-2">
                      <input value={accionEdit.texto} onChange={(e) => setAccionEdit({ id: c.id, texto: e.target.value })} className={cn(inputCls, "h-9 text-[12px]")}
                        placeholder="Ej: Llamar el jueves para firmar autorización" onKeyDown={(e) => { if (e.key === "Enter") void guardarAccion(); }} autoFocus />
                      <button onClick={() => void guardarAccion()} className="text-[12px] font-semibold text-[#8A6529] px-2">Guardar</button>
                      <button onClick={() => setAccionEdit(null)} className="text-[12px] text-[#676B63] px-2">Cancelar</button>
                    </div>
                  ) : esTitular ? (
                    <button onClick={() => setAccionEdit({ id: c.id, texto: c.proxima_accion ?? "" })} className="text-[12px] text-left w-full hover:text-[#8A6529]">
                      <span className="font-semibold text-[#565B56]">Próxima acción: </span>
                      <span className={c.proxima_accion ? "text-[#1F2421]" : "text-[#A3A69C] italic"}>{c.proxima_accion || "sin definir · tocá para agregar"}</span>
                    </button>
                  ) : (
                    <p className="text-[12px]"><span className="font-semibold text-[#565B56]">Próxima acción: </span><span className={c.proxima_accion ? "text-[#1F2421]" : "text-[#A3A69C] italic"}>{c.proxima_accion || "sin definir"}</span></p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNuevo && (
        <Modal titulo="Nueva captación" onClose={() => setShowNuevo(false)} ancho="sm:max-w-md"
          footer={<><button onClick={() => setShowNuevo(false)} className={`${btnSecundario} flex-1`}>Cancelar</button>
            <button onClick={() => void crear()} disabled={guardando} className={`${btnPrimario} flex-1`}>{guardando && <Loader2 size={14} className="animate-spin" />}Guardar</button></>}>
          <Field label="Propietario">
            <ClienteSelect value={form.clienteId} onChange={(id) => setForm({ ...form, clienteId: id })} clientes={clientes} onCreado={(c) => setClientes((cs) => [...cs, c])}
              tipos={["propietario", "lead", "otro"]} tipoNuevo="propietario" placeholder="Elegí o cargá al propietario" />
          </Field>
          <Field label="Dirección"><input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} className={inputCls} placeholder="Sarmiento 234, San Martín" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo"><select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoProp })} className={inputCls}>{TIPOS.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Operación"><select value={form.operacion} onChange={(e) => setForm({ ...form, operacion: e.target.value as Captacion["operacion"] })} className={inputCls}><option>Venta</option><option>Alquiler</option></select></Field>
          </div>
          <Field label="Valor pretendido (USD, opcional)"><input type="number" inputMode="decimal" min="0" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className={inputCls} /></Field>
          <Field label="Próxima acción (opcional)"><input value={form.proximaAccion} onChange={(e) => setForm({ ...form, proximaAccion: e.target.value })} className={inputCls} placeholder="Ej: Coordinar visita para tasar" /></Field>
        </Modal>
      )}
    </div>
  );
}
