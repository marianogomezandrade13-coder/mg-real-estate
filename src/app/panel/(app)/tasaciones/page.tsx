"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Sparkles, FileText, Loader2, Home, Trash2, MessageCircle, Plus, ExternalLink, X } from "lucide-react";
import { PageHeader } from "@/components/panel/PageHeader";
import { Vacio, ErrorCarga } from "@/components/panel/ui";
import { sb, fechaAR, subirArchivo, urlTemporal } from "@/lib/panel-db";
import { siguienteNumeroTasacion, combinarObservaciones, operacionDeObservaciones, type Tasacion } from "@/lib/panel-tasaciones";
import { generarTasacionIA, type ResultadoTasacionIA } from "@/lib/ia-tasacion";
import { OPERACIONES, valorComparable, type Operacion, type Comparable } from "@/lib/tasacion-calculo";
import { construirTasacion } from "@/lib/pdf/tasacion";
import { obtenerImagenMapa } from "@/lib/mapa-estatico";
import { waLink } from "@/lib/brand";
import { useEsTitular } from "@/lib/rol-context";
import { cn } from "@/lib/utils";

const TIPOS = ["Casa", "Departamento", "PH", "Finca", "Oficina", "Local", "Lote"];
const ESTADOS = ["A estrenar", "Muy bueno", "Bueno", "Regular", "A refaccionar"];
const ZONAS = ["San Martín Centro", "San Martín Norte", "San Martín Sur", "Palmares", "Junín", "Otra"];
const PORTALES = ["ZonaProp", "MendozaProp", "Argenprop", "Otro"];
const PORTALES_LINK = [
  { nombre: "ZonaProp", url: "https://www.zonaprop.com.ar/" },
  { nombre: "MendozaProp", url: "https://www.mendozaprop.com/" },
  { nombre: "Argenprop", url: "https://www.argenprop.com/" },
];

type Prop = { id: string; codigo: string; titulo: string; direccion: string | null; tipo: string };
type FilaComparable = { portal: string; direccion: string; precio: string; m2: string; link: string };
const nuevaFilaComparable = (): FilaComparable => ({ portal: "ZonaProp", direccion: "", precio: "", m2: "", link: "" });
const FORM0 = { propiedadId: "", direccion: "", operacion: "venta" as Operacion, tipo: "Casa", estado: "Bueno", m2Terreno: "", m2Cubierto: "", precioTerreno: "", precioCubierto: "", antiguedad: "", zona: "San Martín Centro", transporte: 3, servicios: 4, seguridad: 3, entorno: 4, observaciones: "" };

function ScoreBar({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[12px] text-[#565B56] w-24 flex-shrink-0">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${label}: ${n} de 5`}
            className={cn("w-7 h-2.5 rounded-full transition-colors", n <= value ? "bg-[#8A6529]" : "bg-[#E9E4D8]")} />
        ))}
      </div>
      <span className="text-[12px] font-bold text-[#8A6529] w-4">{value}</span>
    </div>
  );
}

const num = (v: string) => parseFloat(v) || 0;
const fmtUnidad = (v: number, unidad: string) => `USD ${Math.round(v).toLocaleString("es-AR")}${unidad === "USD" ? "" : ` ${unidad.replace("USD/", "/")}`}`;
const operacionLabelDe = (observaciones: string | null) => OPERACIONES.find((o) => o.value === operacionDeObservaciones(observaciones))!.label;
const unidadDe = (observaciones: string | null) => OPERACIONES.find((o) => o.value === operacionDeObservaciones(observaciones))!.unidad;
const inputCls = "w-full h-10 border border-[#E9E4D8] rounded-[9px] px-3 text-[16px] sm:text-[13px] outline-none focus:border-[#8A6529] bg-white";
const labelCls = "block text-[12px] font-semibold text-[#565B56] mb-1";

export default function TasacionesPage() {
  const [tasaciones, setTasaciones] = useState<Tasacion[]>([]);
  const [props, setProps] = useState<Prop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState(FORM0);
  const [comparables, setComparables] = useState<FilaComparable[]>([]);
  const [resultado, setResultado] = useState<ResultadoTasacionIA | null>(null);
  const [generando, setGenerando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [extensionCantidad, setExtensionCantidad] = useState<number | null>(null);

  // Puente con la extensión de Chrome "MG Comparables" (opcional): si está instalada, avisa su presencia
  // y cuántos comparables relevados tiene guardados; solo los manda cuando esta página los pide explícitamente.
  useEffect(() => {
    type ComparableExt = { id: string; portal: string; direccion: string | null; precio: number | null; moneda: string | null; m2: number | null; operacion: Operacion | null; link: string };
    const onReady = (e: Event) => setExtensionCantidad((e as CustomEvent<{ cantidad: number }>).detail?.cantidad ?? 0);
    const onDatos = (e: Event) => {
      const items = (e as CustomEvent<ComparableExt[]>).detail ?? [];
      if (!items.length) { setExtensionCantidad(0); return; }
      let sinMoneda = 0;
      let desajusteOperacion = 0;
      setComparables((cs) => {
        const yaLinks = new Set(cs.map((c) => c.link).filter(Boolean));
        const nuevos = items
          .filter((it) => !it.link || !yaLinks.has(it.link))
          .map((it) => {
            // Solo se autocompleta el precio cuando la moneda es inequívocamente USD (así se lee en el
            // portal). Si no se pudo determinar la moneda (o es pesos), se deja vacío para que lo cargue
            // el tasador a mano: mejor un campo vacío que un número mal convertido en un informe profesional.
            if (it.moneda !== "USD" && it.precio) sinMoneda++;
            if (it.operacion && it.operacion !== form.operacion) desajusteOperacion++;
            return {
              portal: PORTALES.includes(it.portal) ? it.portal : "Otro",
              direccion: it.direccion || "", link: it.link || "", m2: it.m2 ? String(it.m2) : "",
              precio: it.moneda === "USD" && it.precio ? String(it.precio) : "",
            };
          });
        return nuevos.length ? [...cs, ...nuevos] : cs;
      });
      window.dispatchEvent(new CustomEvent("mg-extension-marcar-usados", { detail: items.map((it) => it.id) }));
      toast.success(`Se importaron ${items.length} comparable(s) de la extensión`);
      if (sinMoneda) toast.message(`${sinMoneda} no traían un precio en dólares claro: completá el precio a mano en esas filas.`);
      if (desajusteOperacion) toast.message(`${desajusteOperacion} parecen ser de una operación distinta a "${OPERACIONES.find((o) => o.value === form.operacion)?.label}": revisá que correspondan.`);
      setExtensionCantidad(0);
    };
    window.addEventListener("mg-extension-ready", onReady);
    window.addEventListener("mg-extension-comparables", onDatos);
    return () => {
      window.removeEventListener("mg-extension-ready", onReady);
      window.removeEventListener("mg-extension-comparables", onDatos);
    };
    // form.operacion se usa adentro de onDatos (para avisar si un comparable importado no coincide);
    // sin esto en las dependencias, el handler quedaría con la operación de cuando se montó la página.
  }, [form.operacion]);
  const importarDeExtension = () => window.dispatchEvent(new Event("mg-extension-pedir"));

  const cargar = useCallback(async () => {
    const [t, p] = await Promise.all([
      sb.from("tasaciones").select("*").order("created_at", { ascending: false }),
      sb.from("propiedades").select("id,codigo,titulo,direccion,tipo").order("codigo"),
    ]);
    if (t.error) setError(t.error.message); else { setError(null); setTasaciones(t.data ?? []); setProps(p.data ?? []); }
    setLoading(false);
  }, []);
  useEffect(() => { const tm = setTimeout(() => void cargar(), 0); return () => clearTimeout(tm); }, [cargar]);

  const elegirPropiedad = (id: string) => {
    const p = props.find((x) => x.id === id);
    setForm((f) => ({ ...f, propiedadId: id, direccion: p?.direccion || f.direccion, tipo: TIPOS.includes(p?.tipo ?? "") ? p!.tipo : f.tipo }));
  };

  const comparablesValidos: Comparable[] = useMemo(
    () => comparables.filter((c) => num(c.precio) > 0).map((c) => ({ portal: c.portal, direccion: c.direccion.trim(), precio: num(c.precio), m2: c.m2 ? num(c.m2) : null, link: c.link.trim() })),
    [comparables]
  );
  const agregarComparable = () => setComparables((cs) => [...cs, nuevaFilaComparable()]);
  const quitarComparable = (i: number) => setComparables((cs) => cs.filter((_, k) => k !== i));
  const setComparable = <K extends keyof FilaComparable>(i: number, k: K, v: FilaComparable[K]) =>
    setComparables((cs) => cs.map((c, idx) => (idx === i ? { ...c, [k]: v } : c)));

  const generar = async () => {
    const esTemporal = form.operacion === "alquiler_temporal";
    if (!form.direccion.trim()) return void toast.error("Ingresá la dirección del inmueble");
    if (!esTemporal && !(num(form.m2Terreno) > 0 || num(form.m2Cubierto) > 0)) return void toast.error("Ingresá al menos una superficie");
    if (!(num(form.precioTerreno) > 0 || num(form.precioCubierto) > 0) && comparablesValidos.length === 0) return void toast.error("Ingresá un valor de referencia o al menos un comparable con precio");
    setGenerando(true); setResultado(null);
    try {
      const r = await generarTasacionIA({
        operacion: form.operacion, direccion: form.direccion.trim(), tipo: form.tipo, estado: form.estado, zona: form.zona, antiguedad: num(form.antiguedad),
        m2Terreno: num(form.m2Terreno), m2Cubierto: num(form.m2Cubierto), precioTerreno: num(form.precioTerreno), precioCubierto: num(form.precioCubierto),
        transporte: form.transporte, servicios: form.servicios, seguridad: form.seguridad, entorno: form.entorno, observaciones: form.observaciones,
        comparables: comparablesValidos,
      });
      if (!r.ok) { toast.error(r.error); return; }
      setResultado(r.data);
    } catch (e) { toast.error("No se pudo generar la tasación: " + (e as Error).message); }
    finally { setGenerando(false); }
  };

  const guardarYDescargar = async () => {
    if (!resultado) return;
    setGuardando(true);
    try {
      const numero = await siguienteNumeroTasacion();
      const propiedadCodigo = form.propiedadId ? props.find((p) => p.id === form.propiedadId)?.codigo ?? null : null;
      const opLabel = OPERACIONES.find((o) => o.value === form.operacion)!.label;
      const valorM2 = !esTemporal && num(form.m2Cubierto) ? resultado.rec / num(form.m2Cubierto) : 0;
      const fila = {
        numero, propiedad_ref: propiedadCodigo, direccion: form.direccion.trim(), tipo: form.tipo, estado_conservacion: form.estado, zona: form.zona,
        // El terreno no aplica a un alquiler temporal (se cobra por unidad, no por m² de lote): no se guarda para no dejar datos engañosos.
        m2_terreno: esTemporal ? null : num(form.m2Terreno) || null, m2_cubierto: num(form.m2Cubierto) || null,
        precio_m2_terreno: esTemporal ? null : num(form.precioTerreno) || null, precio_m2_cubierto: num(form.precioCubierto) || null, antiguedad_anios: num(form.antiguedad) || null,
        score_transporte: form.transporte, score_servicios: form.servicios, score_seguridad: form.seguridad, score_entorno: form.entorno,
        valor_min: resultado.min, valor_recomendado: resultado.rec, valor_optimo: resultado.opt, valor_final: null,
        observaciones: combinarObservaciones(resultado.informe, form.observaciones, opLabel, comparablesValidos, resultado.esFallback), pdf_url: null, sucursal_id: null,
      };
      const { data, error } = await sb.from("tasaciones").insert(fila).select("*").single();
      if (error || !data) throw new Error(error?.message ?? "No se pudo guardar la tasación");

      // PDF inicial con la fundamentación de la IA, los comparables y las observaciones en secciones separadas
      // El mapa es "mejor esfuerzo": si no hay clave configurada o falla la geocodificación, se sigue sin él.
      const mapaDataUrl = await obtenerImagenMapa(form.direccion.trim()).catch(() => null);
      const doc = await construirTasacion({
        numero, direccion: form.direccion.trim(), operacion: form.operacion, tipo: form.tipo, estado: form.estado, zona: form.zona, antiguedad: num(form.antiguedad),
        m2Terreno: num(form.m2Terreno), m2Cubierto: num(form.m2Cubierto), precioTerreno: num(form.precioTerreno), precioCubierto: num(form.precioCubierto),
        transporte: form.transporte, servicios: form.servicios, seguridad: form.seguridad, entorno: form.entorno,
        observaciones: form.observaciones, informeIA: resultado.informe, informeEsFallback: resultado.esFallback, min: resultado.min, rec: resultado.rec, opt: resultado.opt, valorM2,
        precioCubiertoAjustado: resultado.precioCubiertoAjustado, aporteCubierto: resultado.aporteCubierto, aporteTerreno: resultado.aporteTerreno,
        mapaDataUrl, comparables: comparablesValidos,
      });
      const path = `tasaciones/${data.id}.pdf`;
      await subirArchivo("pdfs", path, doc.output("blob"));
      await sb.from("tasaciones").update({ pdf_url: path }).eq("id", data.id);
      doc.save(`Tasacion-${numero}.pdf`);

      setTasaciones((ts) => [{ ...data, pdf_url: path }, ...ts]);
      setForm(FORM0); setResultado(null); setComparables([]);
      toast.success(`Tasación ${numero} guardada y descargada`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setGuardando(false); }
  };

  const descargar = async (t: Tasacion) => {
    setTrabajando(t.id);
    try {
      if (t.pdf_url) window.location.assign(await urlTemporal("pdfs", t.pdf_url));
      else {
        const { archivarPdfTasacion } = await import("@/lib/panel-tasaciones");
        const { doc } = await archivarPdfTasacion(t);
        doc.save(`Tasacion-${t.numero}.pdf`);
        setTasaciones((ts) => ts.map((x) => (x.id === t.id ? { ...x, pdf_url: `tasaciones/${t.id}.pdf` } : x)));
      }
    } catch (e) { toast.error("No se pudo obtener el PDF: " + (e as Error).message); }
    finally { setTrabajando(null); }
  };

  const eliminar = async (t: Tasacion) => {
    if (!confirm(`¿Eliminar la tasación ${t.numero}?`)) return;
    const { error } = await sb.from("tasaciones").delete().eq("id", t.id);
    if (error) return void toast.error(error.message);
    if (t.pdf_url) await sb.storage.from("pdfs").remove([t.pdf_url]);
    setTasaciones((ts) => ts.filter((x) => x.id !== t.id));
    toast.success("Tasación eliminada");
  };

  const esTemporal = form.operacion === "alquiler_temporal";
  const esTitular = useEsTitular();

  return (
    <div className="p-4 sm:p-7 space-y-8">
      <PageHeader title="Tasaciones con IA" subtitle="Método comparativo de mercado: cargá comparables reales de portales y la IA redacta el informe" />

      {!esTitular && (
        <div className="bg-white rounded-[16px] shadow-card p-6 text-center text-[13px] text-[#676B63]">
          Solo la titular puede generar tasaciones nuevas. Podés ver y descargar las ya generadas más abajo.
        </div>
      )}

      {esTitular && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulario */}
        <div className="bg-white rounded-[16px] shadow-card p-6 space-y-5">
          <div>
            <h2 className="text-[16px] font-bold text-[#1F2421]">Nueva tasación</h2>
            <p className="text-[12px] text-[#676B63] mt-0.5">Elegí la operación, cargá comparables reales de ZonaProp, MendozaProp o Argenprop y tu valor de referencia. El sistema calcula el rango con el método comparativo y la IA redacta la fundamentación.</p>
          </div>

          {props.length > 0 && (
            <div>
              <label className={labelCls}>Vincular a una propiedad (opcional)</label>
              <select value={form.propiedadId} onChange={(e) => elegirPropiedad(e.target.value)} className={inputCls}>
                <option value="">Sin vincular</option>
                {props.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.titulo}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className={labelCls}>Operación</label>
            <div className="grid grid-cols-3 gap-2">
              {OPERACIONES.map((o) => (
                <button key={o.value} type="button" onClick={() => setForm((f) => ({ ...f, operacion: o.value }))}
                  className={cn("h-10 rounded-[9px] text-[12.5px] font-semibold border transition-colors",
                    form.operacion === o.value ? "bg-[#8A6529] border-[#8A6529] text-white" : "border-[#E9E4D8] text-[#565B56] hover:bg-[#F6F3EC]")}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Dirección</label>
            <input value={form.direccion} onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))} className={inputCls} placeholder="Belgrano 450, San Martín, Mendoza" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Tipo</label><select value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))} className={inputCls}>{TIPOS.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div><label className={labelCls}>Estado</label><select value={form.estado} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))} className={inputCls}>{ESTADOS.map((e) => <option key={e}>{e}</option>)}</select></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Antigüedad (años)</label><input value={form.antiguedad} onChange={(e) => setForm((f) => ({ ...f, antiguedad: e.target.value }))} type="number" inputMode="numeric" min="0" className={inputCls} /></div>
            <div><label className={labelCls}>Zona</label><select value={form.zona} onChange={(e) => setForm((f) => ({ ...f, zona: e.target.value }))} className={inputCls}>{ZONAS.map((z) => <option key={z}>{z}</option>)}</select></div>
          </div>

          {!esTemporal && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={labelCls}>Sup. terreno (m²)</label><input value={form.m2Terreno} onChange={(e) => setForm((f) => ({ ...f, m2Terreno: e.target.value }))} type="number" inputMode="decimal" min="0" className={inputCls} /></div>
              <div><label className={labelCls}>USD/m² terreno</label><input value={form.precioTerreno} onChange={(e) => setForm((f) => ({ ...f, precioTerreno: e.target.value }))} type="number" inputMode="decimal" min="0" className={inputCls} /></div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Sup. cubierta (m²){esTemporal && " (referencia)"}</label><input value={form.m2Cubierto} onChange={(e) => setForm((f) => ({ ...f, m2Cubierto: e.target.value }))} type="number" inputMode="decimal" min="0" className={inputCls} /></div>
            <div>
              <label className={labelCls}>{esTemporal ? "Tarifa de referencia (USD/noche)" : form.operacion === "alquiler" ? "USD/m² cubierto (alquiler/mes)" : "USD/m² cubierto (venta)"}</label>
              <input value={form.precioCubierto} onChange={(e) => setForm((f) => ({ ...f, precioCubierto: e.target.value }))} type="number" inputMode="decimal" min="0" className={inputCls} />
            </div>
          </div>

          <div className="bg-[#F6F3EC] rounded-[12px] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-bold text-[#1F2421] uppercase tracking-wider">Comparables de mercado</p>
              <p className="text-[11px] text-[#676B63]">método comparativo</p>
            </div>
            <p className="text-[11.5px] text-[#676B63] -mt-1">Buscá 2 o 3 publicaciones parecidas en los portales y cargá lo que encuentres: le da al informe una base real de mercado, no solo tu estimación.</p>
            <div className="flex flex-wrap gap-2">
              {PORTALES_LINK.map((p) => (
                <a key={p.nombre} href={p.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#8A6529] bg-white border border-[#E9E4D8] rounded-full px-3 py-1.5 hover:border-[#8A6529] transition-colors">
                  {p.nombre}<ExternalLink size={11} />
                </a>
              ))}
            </div>

            {extensionCantidad !== null && extensionCantidad > 0 && (
              <button type="button" onClick={importarDeExtension}
                className="w-full flex items-center justify-center gap-2 h-10 bg-forest text-gold-light text-[12.5px] font-bold rounded-[9px] hover:bg-forest-3 transition-colors">
                <Sparkles size={14} />Importar {extensionCantidad} comparable{extensionCantidad > 1 ? "s" : ""} de la extensión MG Comparables
              </button>
            )}
            {extensionCantidad === 0 && (
              <p className="text-[10.5px] text-[#A3A69C] text-center">Extensión MG Comparables detectada · buscá en los portales y usá el botón &quot;+ MG Tasaciones&quot; en cada aviso</p>
            )}

            {comparables.map((c, i) => (
              <div key={i} className="bg-white rounded-[10px] border border-[#E9E4D8] p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <select value={c.portal} onChange={(e) => setComparable(i, "portal", e.target.value)} className="h-9 border border-[#E9E4D8] rounded-[8px] px-2 text-[12.5px] bg-white flex-shrink-0">
                    {PORTALES.map((p) => <option key={p}>{p}</option>)}
                  </select>
                  <input value={c.direccion} onChange={(e) => setComparable(i, "direccion", e.target.value)} placeholder="Dirección o barrio" className="h-9 flex-1 min-w-0 border border-[#E9E4D8] rounded-[8px] px-2 text-[16px] sm:text-[12.5px]" />
                  <button type="button" onClick={() => quitarComparable(i)} className="p-2 text-[#C0506A] hover:bg-[#FBECEF] rounded-[8px] flex-shrink-0" aria-label="Quitar comparable"><X size={14} /></button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={c.precio} onChange={(e) => setComparable(i, "precio", e.target.value)} type="number" inputMode="decimal" min="0"
                    placeholder={esTemporal ? "USD/noche" : "Precio USD"} className="h-9 border border-[#E9E4D8] rounded-[8px] px-2 text-[16px] sm:text-[12.5px]" />
                  {!esTemporal && (
                    <input value={c.m2} onChange={(e) => setComparable(i, "m2", e.target.value)} type="number" inputMode="decimal" min="0"
                      placeholder="m²" className="h-9 border border-[#E9E4D8] rounded-[8px] px-2 text-[16px] sm:text-[12.5px]" />
                  )}
                </div>
                <input value={c.link} onChange={(e) => setComparable(i, "link", e.target.value)} placeholder="Link del aviso (opcional)" className="h-9 w-full border border-[#E9E4D8] rounded-[8px] px-2 text-[16px] sm:text-[12.5px]" />
              </div>
            ))}
            <button type="button" onClick={agregarComparable} className="w-full flex items-center justify-center gap-1.5 h-9 border border-dashed border-[#8A6529]/50 text-[#8A6529] text-[12.5px] font-semibold rounded-[9px] hover:bg-white transition-colors">
              <Plus size={14} />Agregar comparable
            </button>
            {comparablesValidos.length > 0 && (() => {
              // Misma cuenta que va a usar el motor de cálculo (calcularValuacion): así el número que se ve
              // ACÁ, antes de generar, es exactamente el que va a aparecer después en "Detalles del cálculo".
              const valores = comparablesValidos.map((c) => valorComparable(c, esTemporal)).filter((v): v is number => v !== null);
              const sinM2 = comparablesValidos.length - valores.length;
              const promedio = valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null;
              return (
                <p className="text-[12px] text-[#565B56] pt-1 border-t border-[#E9E4D8]">
                  {promedio !== null ? (
                    <>Promedio de {valores.length} comparable{valores.length > 1 ? "s" : ""}:{" "}
                      <span className="font-bold text-[#1F2421]">{fmtUnidad(promedio, esTemporal ? "USD/noche" : "USD")}{esTemporal ? "" : "/m²"}</span>
                    </>
                  ) : (
                    <>Cargá el m² de al menos un comparable para calcular el promedio.</>
                  )}
                  {sinM2 > 0 && <span className="text-[#A3A69C]"> ({sinM2} sin m², no {sinM2 > 1 ? "entran" : "entra"} en el promedio)</span>}
                </p>
              );
            })()}
          </div>

          <div className="bg-[#F6F3EC] rounded-[12px] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-bold text-[#1F2421] uppercase tracking-wider">Puntuación de entorno</p>
              <p className="text-[11px] text-[#676B63]">ajusta el valor ±10%</p>
            </div>
            <ScoreBar label="Transporte" value={form.transporte} onChange={(v) => setForm((f) => ({ ...f, transporte: v }))} />
            <ScoreBar label="Servicios" value={form.servicios} onChange={(v) => setForm((f) => ({ ...f, servicios: v }))} />
            <ScoreBar label="Seguridad" value={form.seguridad} onChange={(v) => setForm((f) => ({ ...f, seguridad: v }))} />
            <ScoreBar label="Entorno gral." value={form.entorno} onChange={(v) => setForm((f) => ({ ...f, entorno: v }))} />
          </div>

          <div>
            <label className={labelCls}>Observaciones del tasador (opcional)</label>
            <textarea value={form.observaciones} onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
              rows={3} className="w-full border border-[#E9E4D8] rounded-[9px] px-3 py-2 text-[16px] sm:text-[13px] outline-none focus:border-[#8A6529] resize-none" placeholder="Ej: reciclado hace 2 años, buena luz natural, cochera doble…" />
          </div>

          <button onClick={() => void generar()} disabled={generando} className="w-full flex items-center justify-center gap-2 bg-[#8A6529] text-white font-semibold py-3 rounded-[10px] hover:bg-[#6E4F1F] transition-colors disabled:opacity-60">
            {generando ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {generando ? "Analizando…" : "Generar con IA"}
          </button>
        </div>

        {/* Resultado */}
        <div className="bg-white rounded-[16px] shadow-card p-6">
          {!resultado ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-10">
              <div className="w-16 h-16 rounded-full bg-[#F6EEDD] flex items-center justify-center"><Sparkles size={28} className="text-[#8A6529]" /></div>
              <p className="text-[14px] text-[#676B63] max-w-xs">Completá el formulario y presioná <span className="text-[#8A6529] font-semibold">Generar con IA</span> para ver la valuación sugerida y su fundamentación.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="text-[16px] font-bold text-[#1F2421]">Resultado de la tasación</h2>
                <p className="text-[12px] text-[#676B63] mt-0.5">{form.direccion || "Sin dirección"} · {form.tipo} · {form.zona}</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Valor mínimo", value: resultado.min, sub: "-8%", color: "#C0506A", bg: "#FBECEF" },
                  { label: "Recomendado", value: resultado.rec, sub: "valor sugerido", color: "#8A6529", bg: "#F6EEDD" },
                  { label: "Valor óptimo", value: resultado.opt, sub: "+12%", color: "#1F9D5B", bg: "#EAF7F0" },
                ].map((item) => (
                  <div key={item.label} className="rounded-[12px] p-4 text-center" style={{ background: item.bg }}>
                    <p className="text-[11px] font-semibold" style={{ color: item.color }}>{item.label}</p>
                    <p className="text-[15px] font-bold mt-1 font-[family-name:var(--font-space-grotesk)] break-words" style={{ color: item.color }}>{fmtUnidad(item.value, resultado.unidad)}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: item.color }}>{item.sub}</p>
                  </div>
                ))}
              </div>

              {!esTemporal && resultado.precioCubiertoAjustado > 0 && (
                <div className="bg-[#F6F3EC] rounded-[12px] p-4 space-y-2">
                  <p className="text-[12px] font-bold text-[#1F2421]">Cómo se compone el valor</p>
                  {[
                    ...(num(form.precioCubierto) ? [["Valor de referencia (m² cubierto)", `USD ${Math.round(num(form.precioCubierto)).toLocaleString("es-AR")}/m²`]] : []),
                    ["Ese valor, ajustado por la antigüedad", `USD ${Math.round(resultado.precioCubiertoAjustado).toLocaleString("es-AR")}/m²`],
                    ...(resultado.aporteCubierto ? [["Aporta a la tasación (construcción)", fmtUnidad(resultado.aporteCubierto, resultado.unidad)]] : []),
                    ...(resultado.aporteTerreno ? [["Aporta a la tasación (terreno)", fmtUnidad(resultado.aporteTerreno, resultado.unidad)]] : []),
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-[13px]"><span className="text-[#565B56]">{k}</span><span className="font-semibold text-[#1F2421]">{v}</span></div>
                  ))}
                </div>
              )}

              <div className="bg-[#F6F3EC] rounded-[12px] p-4 space-y-2">
                <p className="text-[12px] font-bold text-[#1F2421]">Detalles del cálculo</p>
                {[
                  ["Promedio de comparables", resultado.promedioComparables ? `${fmtUnidad(resultado.promedioComparables, esTemporal ? "USD/noche" : "USD")}${esTemporal ? "" : "/m²"} (${resultado.comparablesValidos})` : "sin comparables cargados"],
                  ["Ajuste por antigüedad", `${resultado.ajusteAntiguedad.toFixed(1)}%`],
                  ["Ajuste por entorno", `${resultado.ajusteEntorno.toFixed(1)}%`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-[13px]"><span className="text-[#565B56]">{k}</span><span className="font-semibold text-[#1F2421]">{v}</span></div>
                ))}
              </div>

              <div>
                <p className="text-[12px] font-bold text-[#1F2421] mb-1.5">Fundamentación {resultado.esFallback ? "(plantilla automática)" : "(IA)"}</p>
                {resultado.esFallback && (
                  <p className="text-[11.5px] text-[#E0A93B] bg-[#FBF3E2] rounded-[8px] px-3 py-2 mb-2">
                    El servicio de IA no respondió, así que este párrafo se armó con una plantilla en vez de redactarlo Gemini. Los valores (mínimo/recomendado/óptimo) son los mismos: se calculan aparte, no dependen de la IA.
                  </p>
                )}
                <p className="text-[13px] text-[#565B56] leading-relaxed whitespace-pre-wrap">{resultado.informe}</p>
              </div>

              <button onClick={() => void guardarYDescargar()} disabled={guardando}
                className="w-full flex items-center justify-center gap-2 border border-[#8A6529] text-[#8A6529] font-semibold py-3 rounded-[10px] hover:bg-[#F6EEDD] transition-colors disabled:opacity-60">
                {guardando ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} {guardando ? "Guardando…" : "Guardar y descargar informe PDF"}
              </button>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Historial */}
      <div className="bg-white rounded-[16px] shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E9E4D8]"><h2 className="text-[15px] font-bold text-[#1F2421]">Tasaciones realizadas</h2></div>
        {loading ? <div className="flex items-center justify-center py-16 text-[#676B63]"><Loader2 size={20} className="animate-spin mr-2" />Cargando…</div>
        : error ? <ErrorCarga mensaje={error} onReintentar={() => { setLoading(true); void cargar(); }} />
        : tasaciones.length === 0 ? <Vacio icono={<Home size={24} />} titulo="Todavía no hay tasaciones guardadas" texto="Las que generes con la IA y guardes van a quedar acá, con su informe en PDF." />
        : (
          <>
            <div className="md:hidden divide-y divide-[#F6F3EC]">
              {tasaciones.map((t) => (
                <div key={t.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[12px] font-mono font-bold text-[#8A6529]">{t.numero} · {fechaAR(t.created_at)}</p>
                      <p className="text-[13px] font-semibold text-[#1F2421] truncate">{t.direccion}</p>
                      <p className="text-[12px] text-[#676B63]">{`${operacionLabelDe(t.observaciones)} · `}{t.tipo}{t.zona ? ` · ${t.zona}` : ""}{t.propiedad_ref ? ` · ${t.propiedad_ref}` : ""}</p>
                    </div>
                    <p className="text-[15px] font-bold text-[#1F2421] shrink-0">{t.valor_recomendado ? fmtUnidad(t.valor_recomendado, unidadDe(t.observaciones)) : "—"}</p>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <button onClick={() => void descargar(t)} disabled={trabajando === t.id} className="p-2 rounded-[6px] text-[#676B63] hover:bg-[#F6F3EC]" title="Descargar informe" aria-label="Descargar informe">
                      {trabajando === t.id ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                    </button>
                    <a href={waLink(`Hola, te comparto el informe de tasación de ${t.direccion} (${t.numero}).`)} target="_blank" rel="noopener noreferrer" className="p-2 rounded-[6px] text-[#1F9D5B] hover:bg-[#EAF7F0]" title="Avisar por WhatsApp" aria-label="Avisar por WhatsApp"><MessageCircle size={14} /></a>
                    {esTitular && <button onClick={() => void eliminar(t)} className="p-2 rounded-[6px] text-[#C0506A] hover:bg-[#FBECEF]" title="Eliminar" aria-label="Eliminar"><Trash2 size={14} /></button>}
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead><tr className="border-b border-[#E9E4D8]">
                  {["Nº", "Fecha", "Inmueble", "Tipo", "Valor recomendado", ""].map((h) => <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#676B63] uppercase tracking-wider">{h}</th>)}
                </tr></thead>
                <tbody>
                  {tasaciones.map((t) => (
                    <tr key={t.id} className="border-b border-[#F6F3EC] hover:bg-[#F6EEDD] transition-colors">
                      <td className="px-4 py-3 text-[12px] font-mono font-bold text-[#8A6529]">{t.numero}</td>
                      <td className="px-4 py-3 text-[12px] text-[#676B63]">{fechaAR(t.created_at)}</td>
                      <td className="px-4 py-3"><p className="text-[13px] font-semibold text-[#1F2421]">{t.direccion}</p><p className="text-[11px] text-[#676B63]">{`${operacionLabelDe(t.observaciones)} · `}{t.tipo}{t.zona ? ` · ${t.zona}` : ""}{t.propiedad_ref ? ` · ${t.propiedad_ref}` : ""}</p></td>
                      <td className="px-4 py-3 text-[13px] text-[#565B56]">{t.tipo}</td>
                      <td className="px-4 py-3 text-[14px] font-bold text-[#1F2421]">{t.valor_recomendado ? fmtUnidad(t.valor_recomendado, unidadDe(t.observaciones)) : "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => void descargar(t)} disabled={trabajando === t.id} className="p-2 rounded-[6px] text-[#676B63] hover:bg-[#F6F3EC]" title="Descargar informe" aria-label="Descargar informe">
                            {trabajando === t.id ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                          </button>
                          <a href={waLink(`Hola, te comparto el informe de tasación de ${t.direccion} (${t.numero}).`)} target="_blank" rel="noopener noreferrer" className="p-2 rounded-[6px] text-[#1F9D5B] hover:bg-[#EAF7F0]" title="Avisar por WhatsApp" aria-label="Avisar por WhatsApp"><MessageCircle size={14} /></a>
                          {esTitular && <button onClick={() => void eliminar(t)} className="p-2 rounded-[6px] text-[#C0506A] hover:bg-[#FBECEF]" title="Eliminar" aria-label="Eliminar"><Trash2 size={14} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
