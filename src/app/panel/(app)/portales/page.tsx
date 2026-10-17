"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Globe, Sparkles, Loader2, Copy, Check, ExternalLink, Share2, Lightbulb } from "lucide-react";
import { PageHeader } from "@/components/panel/PageHeader";
import { Modal, ErrorCarga, Vacio } from "@/components/panel/ui";
import { sb } from "@/lib/panel-db";
import { generarPublicacionIA, type ResultadoPublicacionIA } from "@/lib/ia-publicacion";
import { generarPostRedesIA, generarIdeaContenidoIA, type ResultadoPostRedes, type ResultadoIdeaContenido } from "@/lib/ia-redes";
import { dinero } from "@/lib/format";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type Prop = Database["public"]["Tables"]["propiedades"]["Row"];
const num = (v: number | null) => v ?? null;

export default function PortalesPage() {
  const [props, setProps] = useState<Prop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activa, setActiva] = useState<Prop | null>(null);
  const [resultado, setResultado] = useState<ResultadoPublicacionIA | null>(null);
  const [generando, setGenerando] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);

  const [redesActiva, setRedesActiva] = useState<Prop | null>(null);
  const [redesResultado, setRedesResultado] = useState<ResultadoPostRedes | null>(null);
  const [redesGenerando, setRedesGenerando] = useState(false);
  const [ideaAbierta, setIdeaAbierta] = useState(false);
  const [idea, setIdea] = useState<ResultadoIdeaContenido | null>(null);
  const [ideaGenerando, setIdeaGenerando] = useState(false);

  const cargar = useCallback(async () => {
    const { data, error } = await sb.from("propiedades").select("*").order("codigo");
    if (error) setError(error.message); else { setError(null); setProps(data ?? []); }
    setLoading(false);
  }, []);
  useEffect(() => { const t = setTimeout(() => void cargar(), 0); return () => clearTimeout(t); }, [cargar]);

  const kpi = useMemo(() => ({
    publicadasWeb: props.filter((p) => p.publicada_web).length,
    activasSinPublicar: props.filter((p) => p.estado === "Activa" && !p.publicada_web).length,
    total: props.length,
  }), [props]);

  const generar = async (p: Prop) => {
    setActiva(p); setResultado(null); setGenerando(true);
    try {
      const amenities = ((p.servicios as { amenities?: string[] } | null)?.amenities) ?? [];
      const r = await generarPublicacionIA({
        tipo: p.tipo, operacion: p.operacion, precio: p.precio, moneda: p.moneda, direccion: p.direccion, barrio: p.barrio, ciudad: p.ciudad,
        ambientes: num(p.ambientes), dormitorios: num(p.dormitorios), banos: num(p.banos), cocheras: num(p.cocheras),
        m2Cubiertos: num(p.m2_cubiertos), m2Totales: num(p.m2_totales), antiguedad: num(p.antiguedad), amenities, descripcion: p.descripcion,
      });
      if (!r.ok) { toast.error(r.error); setActiva(null); return; }
      setResultado(r.data);
    } catch (e) { toast.error("No se pudo generar: " + (e as Error).message); setActiva(null); }
    finally { setGenerando(false); }
  };

  const generarRedes = async (p: Prop) => {
    setRedesActiva(p); setRedesResultado(null); setRedesGenerando(true);
    try {
      const amenities = ((p.servicios as { amenities?: string[] } | null)?.amenities) ?? [];
      const r = await generarPostRedesIA({
        tipo: p.tipo, operacion: p.operacion, precio: p.precio, moneda: p.moneda, direccion: p.direccion, barrio: p.barrio, ciudad: p.ciudad,
        ambientes: num(p.ambientes), dormitorios: num(p.dormitorios), banos: num(p.banos), cocheras: num(p.cocheras),
        m2Cubiertos: num(p.m2_cubiertos), m2Totales: num(p.m2_totales), antiguedad: num(p.antiguedad), amenities,
      });
      if (!r.ok) { toast.error(r.error); setRedesActiva(null); return; }
      setRedesResultado(r.data);
    } catch (e) { toast.error("No se pudo generar: " + (e as Error).message); setRedesActiva(null); }
    finally { setRedesGenerando(false); }
  };

  const pedirIdea = async () => {
    setIdeaAbierta(true); setIdea(null); setIdeaGenerando(true);
    try {
      const r = await generarIdeaContenidoIA();
      if (!r.ok) { toast.error(r.error); setIdeaAbierta(false); return; }
      setIdea(r.data);
    } catch (e) { toast.error("No se pudo generar: " + (e as Error).message); setIdeaAbierta(false); }
    finally { setIdeaGenerando(false); }
  };

  const copiar = async (k: string, texto: string) => {
    try { await navigator.clipboard.writeText(texto); setCopiado(k); setTimeout(() => setCopiado(null), 1800); toast.success("Copiado"); }
    catch { toast.error("No se pudo copiar. Seleccioná el texto manualmente."); }
  };

  const textoCompleto = (p: Prop, r: ResultadoPublicacionIA) =>
    `${r.titulo}\n\n${r.descripcion}\n\n${dinero(p.precio, p.moneda)} · ${p.codigo}\n${BRAND.name} · ${BRAND.phoneDisplay}`;

  return (
    <div className="p-4 sm:p-7 space-y-6">
      <PageHeader title="Portales & Redes" subtitle="Contenido listo para publicar y estado en tu propia web" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-[16px] shadow-card p-5">
          <div className="flex items-center justify-between mb-3"><p className="text-[14px] font-bold text-[#1F2421]">Sitio web MG</p>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-[#1F9D5B] bg-[#EAF7F0] px-2 py-0.5 rounded-full"><CheckCircle2 size={10} /> Automático</span></div>
          <p className="text-[24px] font-bold text-[#8A6529] font-[family-name:var(--font-space-grotesk)]">{kpi.publicadasWeb}</p>
          <p className="text-[12px] text-[#676B63]">publicadas · se actualiza solo</p>
        </div>
        <div className="bg-white rounded-[16px] shadow-card p-5">
          <p className="text-[14px] font-bold text-[#1F2421] mb-3">Activas sin publicar</p>
          <p className="text-[24px] font-bold text-[#8A5A0F] font-[family-name:var(--font-space-grotesk)]">{kpi.activasSinPublicar}</p>
          <p className="text-[12px] text-[#676B63]">revisalas en Propiedades</p>
        </div>
        {["ZonaProp", "Argenprop"].map((nombre) => (
          <div key={nombre} className="bg-white rounded-[16px] shadow-card p-5">
            <div className="flex items-center justify-between mb-3"><p className="text-[14px] font-bold text-[#1F2421]">{nombre}</p>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-[#676B63] bg-[#F6F3EC] px-2 py-0.5 rounded-full"><XCircle size={10} /> Manual</span></div>
            <p className="text-[12px] text-[#676B63]">Todavía no conectado. Generá el contenido acá y pegalo en el portal.</p>
          </div>
        ))}
      </div>

      <div className="bg-[#16201B] rounded-[16px] p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-11 h-11 rounded-[12px] bg-[#8A6529]/20 flex items-center justify-center flex-shrink-0"><Globe size={18} className="text-[#D9BC85]" /></div>
        <div className="flex-1">
          <p className="text-white font-bold text-[14px]">Publicar en ZonaProp, Argenprop o Mercado Libre todavía es manual</p>
          <p className="text-[#8E9389] text-[12px] mt-0.5">Cada portal requiere una cuenta y credenciales propias para publicar automático. Mientras tanto, generá el título y la descripción con IA acá abajo y copialos al crear el aviso en cada sitio.</p>
        </div>
      </div>

      <div className="bg-[#F6EEDD] border border-[#D9BC85]/40 rounded-[16px] p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-11 h-11 rounded-[12px] bg-white flex items-center justify-center flex-shrink-0"><Lightbulb size={18} className="text-[#8A6529]" /></div>
        <div className="flex-1">
          <p className="text-[#1F2421] font-bold text-[14px]">¿Hoy no hay nada nuevo para publicar?</p>
          <p className="text-[#565B56] text-[12px] mt-0.5">Pedí una idea de contenido para mantener activas las redes, sin depender de una propiedad puntual.</p>
        </div>
        <button onClick={() => void pedirIdea()} className="flex items-center justify-center gap-2 bg-[#16201B] text-[#D9BC85] text-[13px] font-semibold px-4 py-2.5 rounded-[10px] hover:bg-[#1F2C26] transition-colors sm:flex-shrink-0">
          <Sparkles size={15} />Pedir idea de hoy
        </button>
      </div>

      <div className="bg-white rounded-[16px] shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E9E4D8] flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-[#1F2421]">Generar contenido por propiedad</h2>
          <span className="text-[12px] text-[#676B63]">{props.length} propiedades</span>
        </div>
        {loading ? <div className="flex items-center justify-center py-16 text-[#676B63]"><Loader2 size={20} className="animate-spin mr-2" />Cargando…</div>
        : error ? <ErrorCarga mensaje={error} onReintentar={() => { setLoading(true); void cargar(); }} />
        : props.length === 0 ? <Vacio icono={<Globe size={24} />} titulo="Todavía no hay propiedades cargadas" texto="Cargá propiedades en el módulo Propiedades para poder generar contenido para portales." />
        : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px]">
            <thead><tr className="border-b border-[#E9E4D8]">
              {["Propiedad", "Web", ""].map((h) => <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#676B63] uppercase tracking-wider">{h}</th>)}
            </tr></thead>
            <tbody>
              {props.map((p) => (
                <tr key={p.id} className="border-b border-[#F6F3EC] hover:bg-[#F6EEDD] transition-colors">
                  <td className="px-4 py-3"><p className="text-[13px] font-semibold text-[#1F2421]">{p.titulo}</p><p className="text-[11px] font-mono text-[#8A6529]">{p.codigo}</p></td>
                  <td className="px-4 py-3">{p.publicada_web ? <CheckCircle2 size={16} className="text-[#1F9D5B]" /> : <XCircle size={16} className="text-[#E9E4D8]" />}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button onClick={() => void generar(p)} disabled={generando && activa?.id === p.id}
                        className="inline-flex items-center gap-1.5 border border-[#8A6529] text-[#8A6529] text-[12px] font-semibold px-3 py-1.5 rounded-[8px] hover:bg-[#F6EEDD] transition-colors disabled:opacity-60">
                        {generando && activa?.id === p.id ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}Portal
                      </button>
                      <button onClick={() => void generarRedes(p)} disabled={redesGenerando && redesActiva?.id === p.id}
                        className="inline-flex items-center gap-1.5 border border-[#565B56] text-[#565B56] text-[12px] font-semibold px-3 py-1.5 rounded-[8px] hover:bg-[#F6F3EC] transition-colors disabled:opacity-60">
                        {redesGenerando && redesActiva?.id === p.id ? <Loader2 size={13} className="animate-spin" /> : <Share2 size={13} />}Redes
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {activa && (
        <Modal titulo={`Contenido para ${activa.codigo}`} onClose={() => { setActiva(null); setResultado(null); }} ancho="sm:max-w-lg">
          {generando ? <div className="flex items-center justify-center py-10 text-[#676B63]"><Loader2 size={20} className="animate-spin mr-2" />Generando con IA…</div>
          : resultado && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1"><label className="text-[12px] font-semibold text-[#565B56]">Título SEO</label>
                  <button onClick={() => void copiar("titulo", resultado.titulo)} className="text-[11px] font-semibold text-[#8A6529] flex items-center gap-1 hover:underline">{copiado === "titulo" ? <Check size={12} /> : <Copy size={12} />}Copiar</button></div>
                <p className="text-[13px] bg-[#F6F3EC] rounded-[10px] px-3 py-2.5">{resultado.titulo}</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1"><label className="text-[12px] font-semibold text-[#565B56]">Descripción</label>
                  <button onClick={() => void copiar("desc", resultado.descripcion)} className="text-[11px] font-semibold text-[#8A6529] flex items-center gap-1 hover:underline">{copiado === "desc" ? <Check size={12} /> : <Copy size={12} />}Copiar</button></div>
                <p className="text-[13px] bg-[#F6F3EC] rounded-[10px] px-3 py-2.5 whitespace-pre-wrap leading-relaxed">{resultado.descripcion}</p>
              </div>
              <button onClick={() => void copiar("todo", textoCompleto(activa, resultado))}
                className={cn("w-full flex items-center justify-center gap-2 text-[13px] font-semibold py-2.5 rounded-[10px] transition-colors", copiado === "todo" ? "bg-[#EAF7F0] text-[#1F9D5B]" : "bg-[#16201B] text-[#D9BC85] hover:bg-[#1F2C26]")}>
                {copiado === "todo" ? <Check size={15} /> : <Copy size={15} />}Copiar todo listo para pegar
              </button>
              <div className="flex gap-2 pt-1">
                <a href="https://www.zonaprop.com.ar" target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 text-[12px] font-semibold text-[#565B56] border border-[#E9E4D8] py-2 rounded-[9px] hover:bg-[#F6F3EC]">ZonaProp <ExternalLink size={11} /></a>
                <a href="https://www.argenprop.com" target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 text-[12px] font-semibold text-[#565B56] border border-[#E9E4D8] py-2 rounded-[9px] hover:bg-[#F6F3EC]">Argenprop <ExternalLink size={11} /></a>
              </div>
              <button onClick={() => void generar(activa)} className="w-full text-[12px] font-semibold text-[#8A6529] hover:underline">Regenerar</button>
            </div>
          )}
        </Modal>
      )}

      {redesActiva && (
        <Modal titulo={`Posteo para redes · ${redesActiva.codigo}`} onClose={() => { setRedesActiva(null); setRedesResultado(null); }} ancho="sm:max-w-lg">
          {redesGenerando ? <div className="flex items-center justify-center py-10 text-[#676B63]"><Loader2 size={20} className="animate-spin mr-2" />Generando con IA…</div>
          : redesResultado && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1"><label className="text-[12px] font-semibold text-[#565B56]">Texto del posteo</label>
                  <button onClick={() => void copiar("caption", redesResultado.caption)} className="text-[11px] font-semibold text-[#8A6529] flex items-center gap-1 hover:underline">{copiado === "caption" ? <Check size={12} /> : <Copy size={12} />}Copiar</button></div>
                <p className="text-[13px] bg-[#F6F3EC] rounded-[10px] px-3 py-2.5 whitespace-pre-wrap leading-relaxed">{redesResultado.caption}</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1"><label className="text-[12px] font-semibold text-[#565B56]">Hashtags</label>
                  <button onClick={() => void copiar("hashtags", redesResultado.hashtags.join(" "))} className="text-[11px] font-semibold text-[#8A6529] flex items-center gap-1 hover:underline">{copiado === "hashtags" ? <Check size={12} /> : <Copy size={12} />}Copiar</button></div>
                <p className="text-[13px] bg-[#F6F3EC] rounded-[10px] px-3 py-2.5 text-[#2F5FA8]">{redesResultado.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}</p>
              </div>
              <button onClick={() => void copiar("todo-redes", `${redesResultado.caption}\n\n${redesResultado.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}`)}
                className={cn("w-full flex items-center justify-center gap-2 text-[13px] font-semibold py-2.5 rounded-[10px] transition-colors", copiado === "todo-redes" ? "bg-[#EAF7F0] text-[#1F9D5B]" : "bg-[#16201B] text-[#D9BC85] hover:bg-[#1F2C26]")}>
                {copiado === "todo-redes" ? <Check size={15} /> : <Copy size={15} />}Copiar todo listo para pegar
              </button>
              <button onClick={() => void generarRedes(redesActiva)} className="w-full text-[12px] font-semibold text-[#8A6529] hover:underline">Regenerar</button>
            </div>
          )}
        </Modal>
      )}

      {ideaAbierta && (
        <Modal titulo="Idea de contenido de hoy" onClose={() => { setIdeaAbierta(false); setIdea(null); }} ancho="sm:max-w-lg">
          {ideaGenerando ? <div className="flex items-center justify-center py-10 text-[#676B63]"><Loader2 size={20} className="animate-spin mr-2" />Pensando una idea…</div>
          : idea && (
            <div className="space-y-4">
              <div className="bg-[#F6EEDD] rounded-[10px] px-3.5 py-2.5">
                <p className="text-[11px] font-bold text-[#8A6529] uppercase tracking-wide mb-0.5">La idea</p>
                <p className="text-[13px] text-[#1F2421]">{idea.idea}</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1"><label className="text-[12px] font-semibold text-[#565B56]">Posteo listo</label>
                  <button onClick={() => void copiar("idea-caption", idea.caption)} className="text-[11px] font-semibold text-[#8A6529] flex items-center gap-1 hover:underline">{copiado === "idea-caption" ? <Check size={12} /> : <Copy size={12} />}Copiar</button></div>
                <p className="text-[13px] bg-[#F6F3EC] rounded-[10px] px-3 py-2.5 whitespace-pre-wrap leading-relaxed">{idea.caption}</p>
              </div>
              <button onClick={() => void pedirIdea()} className="w-full text-[12px] font-semibold text-[#8A6529] hover:underline">Pedir otra idea</button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
