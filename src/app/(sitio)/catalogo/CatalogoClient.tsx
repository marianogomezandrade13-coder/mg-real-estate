"use client";

import { useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { SlidersHorizontal, X, SearchX, MessageCircle, ChevronRight, ChevronDown, Bell, LayoutGrid, Map as MapIcon } from "lucide-react";
import { PropertyCard } from "@/components/sitio/PropertyCard";
import { TIPOS_FILTRO, type Operacion, type Propiedad } from "@/lib/propiedades";
import { BRAND, waLink } from "@/lib/brand";
import { cn } from "@/lib/utils";

const MapaPropiedades = dynamic(() => import("@/components/sitio/MapaPropiedades"), {
  ssr: false, loading: () => <div className="h-[520px] lg:h-[640px] rounded-[20px] bg-white border border-border-light grid place-items-center text-[13px] text-text-muted">Cargando mapa…</div>,
});
const TIPOS = TIPOS_FILTRO;
// "emprendimiento" (menú) equivale a lotes/loteos en el catálogo actual
const TIPO_DESDE_URL: Record<string, string> = { emprendimiento: "lote" };
const AMBIENTES = ["Todos", "1", "2", "3", "4+"];
const ORDENAR = ["Relevancia", "Menor precio", "Mayor precio", "Más reciente"] as const;
type Orden = (typeof ORDENAR)[number];

const inputCls =
  "w-full h-11 bg-white border border-border-mid rounded-[11px] px-3.5 text-[16px] sm:text-[13px] outline-none focus:border-gold focus:ring-4 focus:ring-gold/15 transition-all";

function CatalogoContent({ propiedades }: { propiedades: Propiedad[] }) {
  const sp = useSearchParams();
  const tipoUrl = (sp.get("tipo") || "").toLowerCase();
  const tipoInicial = TIPOS.some((t) => t.v === (TIPO_DESDE_URL[tipoUrl] ?? tipoUrl)) ? (TIPO_DESDE_URL[tipoUrl] ?? tipoUrl) : "";
  const opUrl = sp.get("op");

  const [operacion, setOperacion] = useState<"todas" | Operacion>(opUrl === "venta" || opUrl === "alquiler" ? opUrl : "todas");
  const [tipo, setTipo] = useState(tipoInicial);
  const [ambientes, setAmbientes] = useState("Todos");
  const [busqueda, setBusqueda] = useState(sp.get("q") || "");
  const [orden, setOrden] = useState<Orden>("Relevancia");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [dorm, setDorm] = useState("Todos");
  const [pMin, setPMin] = useState("");
  const [pMax, setPMax] = useState("");
  const [cochera, setCochera] = useState(false);
  const [vista, setVista] = useState<"lista" | "mapa">("lista");
  const minN = pMin.trim() === "" ? null : Number(pMin);
  const maxN = pMax.trim() === "" ? null : Number(pMax);

  const filtradas = useMemo(() => {
    const b = busqueda.trim().toLowerCase();
    const lista = propiedades.filter((p) => {
      if (operacion !== "todas" && p.operacion !== operacion) return false;
      if (tipo && p.tipo !== tipo) return false;
      if (ambientes !== "Todos") {
        if (ambientes === "4+" ? p.ambientes < 4 : p.ambientes !== parseInt(ambientes)) return false;
      }
      if (dorm !== "Todos" && (dorm === "4+" ? p.dormitorios < 4 : p.dormitorios !== parseInt(dorm))) return false;
      if (cochera && p.cocheras < 1) return false;
      // El precio se compara tal cual está cargado (USD en ventas, $ en alquileres): se usa junto con el filtro de operación.
      if (minN != null && !Number.isNaN(minN) && p.precioNum < minN) return false;
      if (maxN != null && !Number.isNaN(maxN) && p.precioNum > maxN) return false;
      if (b && ![p.titulo, p.ubicacion, p.direccion, p.codigo].some((t) => t.toLowerCase().includes(b))) return false;
      return true;
    });
    // Al mezclar monedas no se convierten: USD (ventas) va antes que ARS (alquileres) y se ordena dentro de cada grupo.
    const porPrecio = (dir: 1 | -1) => (a: (typeof lista)[number], c: (typeof lista)[number]) =>
      a.moneda !== c.moneda ? (a.moneda === "USD" ? -1 : 1) : (a.precioNum - c.precioNum) * dir;
    const porFecha = (a: (typeof lista)[number], c: (typeof lista)[number]) => c.publicada.localeCompare(a.publicada);
    return [...lista].sort(
      orden === "Menor precio" ? porPrecio(1)
      : orden === "Mayor precio" ? porPrecio(-1)
      : orden === "Más reciente" ? porFecha
      : porFecha
    );
  }, [propiedades, operacion, tipo, ambientes, busqueda, orden, dorm, cochera, minN, maxN]);

  const chips = [
    operacion !== "todas" && { k: "op", l: operacion === "venta" ? "Comprar" : "Alquilar", clear: () => setOperacion("todas") },
    tipo && { k: "tipo", l: TIPOS.find((t) => t.v === tipo)?.l ?? tipo, clear: () => setTipo("") },
    ambientes !== "Todos" && { k: "amb", l: `${ambientes} amb`, clear: () => setAmbientes("Todos") },
    dorm !== "Todos" && { k: "dorm", l: `${dorm} dorm.`, clear: () => setDorm("Todos") },
    cochera && { k: "coch", l: "Con cochera", clear: () => setCochera(false) },
    (pMin.trim() || pMax.trim()) && { k: "precio", l: `Precio ${pMin.trim() ? `desde ${Number(pMin).toLocaleString("es-AR")}` : ""}${pMin.trim() && pMax.trim() ? " " : ""}${pMax.trim() ? `hasta ${Number(pMax).toLocaleString("es-AR")}` : ""}`, clear: () => { setPMin(""); setPMax(""); } },
    busqueda.trim() && { k: "q", l: `“${busqueda.trim()}”`, clear: () => setBusqueda("") },
  ].filter(Boolean) as { k: string; l: string; clear: () => void }[];

  const limpiar = () => { setOperacion("todas"); setTipo(""); setBusqueda(""); setAmbientes("Todos"); setDorm("Todos"); setCochera(false); setPMin(""); setPMax(""); };

  return (
    <>
      {/* Cabecera editorial */}
      <section className="bg-forest border-b border-gold-light/10">
        <div className="max-w-7xl mx-auto px-6 pt-10 pb-12">
          <nav aria-label="Migas de pan" className="text-[12px] text-white/50 flex items-center gap-1.5 mb-5">
            <Link href="/" className="hover:text-gold-light transition-colors">Inicio</Link>
            <ChevronRight size={12} />
            <span className="text-white/80 font-semibold">Catálogo</span>
          </nav>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
            <div>
              <p className="text-gold-light text-[11px] font-bold tracking-[0.28em] uppercase mb-3 flex items-center gap-3">
                <span className="h-px w-8 bg-gold-light/60" />Catálogo
              </p>
              <h1 className="font-display text-white text-[40px] md:text-[56px] font-medium leading-none">
                Propiedades <span className="text-gold-gradient italic">en Mendoza</span>
              </h1>
            </div>
            <p className="text-white/60 text-[14px]" aria-live="polite">
              <span className="text-gold-light font-semibold tabular-nums">{filtradas.length}</span>{" "}
              {filtradas.length === 1 ? "resultado" : "resultados"}
            </p>
          </div>
        </div>
      </section>

      <div className="bg-app-bg">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* ---------- Filtros ---------- */}
            <aside className="lg:w-72 shrink-0">
              <button
                onClick={() => setFiltrosAbiertos((v) => !v)}
                aria-expanded={filtrosAbiertos}
                className="lg:hidden w-full flex items-center justify-between bg-white border border-border-mid rounded-[12px] px-4 py-3 text-[14px] font-semibold text-text-primary"
              >
                <span className="flex items-center gap-2"><SlidersHorizontal size={16} className="text-gold" />Filtros{chips.length > 0 && ` (${chips.length})`}</span>
                <ChevronDown size={16} className={cn("transition-transform", filtrosAbiertos && "rotate-180")} />
              </button>

              <div className={cn(
                "bg-white rounded-[20px] border border-border-light p-6 space-y-6 shadow-card lg:sticky lg:top-[88px]",
                "mt-3 lg:mt-0", filtrosAbiertos ? "block" : "hidden lg:block"
              )}>
                <fieldset>
                  <legend className="text-[11px] font-bold text-text-primary uppercase tracking-[0.18em] mb-3">Operación</legend>
                  <div className="grid grid-cols-3 gap-1.5 bg-app-bg rounded-[12px] p-1">
                    {([["todas", "Todas"], ["venta", "Comprar"], ["alquiler", "Alquilar"]] as const).map(([v, l]) => (
                      <button key={v} onClick={() => setOperacion(v)} aria-pressed={operacion === v}
                        className={cn("py-2 text-[12px] font-semibold rounded-[9px] transition-all",
                          operacion === v ? "bg-forest text-gold-light shadow-sm" : "text-text-secondary hover:text-forest")}>
                        {l}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div>
                  <label htmlFor="f-tipo" className="block text-[11px] font-bold text-text-primary uppercase tracking-[0.18em] mb-3">Tipo de propiedad</label>
                  <select id="f-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
                    {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                  </select>
                </div>

                <div>
                  <label htmlFor="f-q" className="block text-[11px] font-bold text-text-primary uppercase tracking-[0.18em] mb-3">Ubicación o código</label>
                  <input id="f-q" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Barrio, ciudad, MG-…" className={inputCls} />
                </div>

                <fieldset>
                  <legend className="text-[11px] font-bold text-text-primary uppercase tracking-[0.18em] mb-3">Ambientes</legend>
                  <div className="flex gap-1.5 flex-wrap">
                    {AMBIENTES.map((a) => (
                      <button key={a} onClick={() => setAmbientes(a)} aria-pressed={ambientes === a}
                        className={cn("px-3.5 py-2 text-[12px] font-semibold rounded-full border transition-all",
                          ambientes === a ? "bg-forest text-gold-light border-forest" : "bg-white border-border-mid text-text-secondary hover:border-gold hover:text-gold")}>
                        {a}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-[11px] font-bold text-text-primary uppercase tracking-[0.18em] mb-3">Dormitorios</legend>
                  <div className="flex gap-1.5 flex-wrap">
                    {AMBIENTES.map((a) => (
                      <button key={a} onClick={() => setDorm(a)} aria-pressed={dorm === a}
                        className={cn("px-3.5 py-2 text-[12px] font-semibold rounded-full border transition-all",
                          dorm === a ? "bg-forest text-gold-light border-forest" : "bg-white border-border-mid text-text-secondary hover:border-gold hover:text-gold")}>
                        {a}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-[11px] font-bold text-text-primary uppercase tracking-[0.18em] mb-3">Precio {operacion === "alquiler" ? "($ por mes)" : operacion === "venta" ? "(USD)" : ""}</legend>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" inputMode="numeric" min="0" value={pMin} onChange={(e) => setPMin(e.target.value)} placeholder="Mínimo" aria-label="Precio mínimo" className={inputCls} />
                    <input type="number" inputMode="numeric" min="0" value={pMax} onChange={(e) => setPMax(e.target.value)} placeholder="Máximo" aria-label="Precio máximo" className={inputCls} />
                  </div>
                  {operacion === "todas" && <p className="mt-2 text-[11px] text-text-muted">Elegí Comprar o Alquilar para comparar en la misma moneda.</p>}
                </fieldset>

                <label className="flex items-center gap-3 text-[13px] text-text-primary cursor-pointer">
                  <input type="checkbox" checked={cochera} onChange={(e) => setCochera(e.target.checked)} className="w-4 h-4 accent-[#8A6529]" />
                  Con cochera
                </label>

                <button onClick={limpiar} disabled={chips.length === 0}
                  className="w-full py-2 text-[12px] font-bold text-gold hover:text-gold-dark disabled:text-text-dim disabled:cursor-not-allowed transition-colors">
                  Limpiar filtros
                </button>
              </div>
            </aside>

            {/* ---------- Resultados ---------- */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div className="flex flex-wrap gap-2">
                  {chips.map((c) => (
                    <button key={c.k} onClick={c.clear} aria-label={`Quitar filtro ${c.l}`}
                      className="group inline-flex items-center gap-1.5 bg-gold-bg text-gold-dark text-[12px] font-semibold pl-3.5 pr-2.5 py-1.5 rounded-full hover:bg-champagne/70 transition-colors">
                      {c.l}<X size={13} className="opacity-60 group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
                <div className="inline-flex rounded-[10px] border border-border-mid bg-white p-0.5 ml-auto" role="group" aria-label="Tipo de vista">
                  {([["lista", "Lista", LayoutGrid], ["mapa", "Mapa", MapIcon]] as const).map(([v, l, Ic]) => (
                    <button key={v} onClick={() => setVista(v)} aria-pressed={vista === v}
                      className={cn("inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] text-[12px] font-semibold transition-colors", vista === v ? "bg-forest text-gold-light" : "text-text-secondary hover:text-forest")}>
                      <Ic size={14} />{l}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2.5 text-[13px] text-text-muted">
                  Ordenar por
                  <select value={orden} onChange={(e) => setOrden(e.target.value as Orden)}
                    className="h-10 bg-white border border-border-mid rounded-[10px] px-3 text-[13px] text-text-primary outline-none focus:border-gold focus:ring-4 focus:ring-gold/15">
                    {ORDENAR.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </label>
              </div>

              {filtradas.length === 0 ? (
                <div className="bg-white rounded-[24px] border border-border-light p-12 text-center">
                  <span className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-gold-bg text-gold"><SearchX size={28} strokeWidth={1.5} /></span>
                  <h2 className="font-display text-[28px] font-medium text-forest mt-6">{propiedades.length === 0 ? "Muy pronto vas a ver nuestras propiedades" : "No encontramos propiedades con esos filtros"}</h2>
                  <p className="text-[14px] text-text-muted mt-2 max-w-md mx-auto">
                    Probá con otros criterios o contanos qué buscás: muchas propiedades se conocen antes de publicarse.
                  </p>
                  <div className="mt-7 flex flex-wrap justify-center gap-3">
                    <button onClick={limpiar} className="px-6 py-3 rounded-[12px] bg-forest text-gold-light text-[14px] font-bold hover:bg-forest-3 transition-colors">
                      Limpiar filtros
                    </button>
                    <a href={waLink(`Hola, no encontré lo que busco en el catálogo de ${BRAND.name}. ¿Me pueden ayudar?`)} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-[12px] border border-gold text-gold text-[14px] font-bold hover:bg-gold-bg transition-colors">
                      <MessageCircle size={16} />Consultar por WhatsApp
                    </a>
                    <Link href="/contacto?asunto=alerta" className="inline-flex items-center gap-2 px-6 py-3 rounded-[12px] border border-border-mid text-text-primary text-[14px] font-bold hover:bg-app-bg transition-colors">
                      <Bell size={16} />Avisarme cuando haya algo así
                    </Link>
                  </div>
                </div>
              ) : vista === "mapa" ? (
                <>
                  <MapaPropiedades propiedades={filtradas} />
                  <p className="mt-3 text-[12px] text-text-muted">
                    Ubicación aproximada de cada zona. {filtradas.filter((p) => !p.coords).length > 0 && `${filtradas.filter((p) => !p.coords).length} propiedad(es) sin ubicación se ven en la vista Lista.`}
                  </p>
                </>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filtradas.map((p, i) => <PropertyCard key={p.codigo} p={p} index={i} />)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** Re-monta el catálogo cuando cambian los parámetros (el menú navega entre /catalogo?op=… sin desmontar la página). */
function CatalogoKeyed({ propiedades }: { propiedades: Propiedad[] }) {
  const searchParams = useSearchParams();
  return <CatalogoContent key={searchParams.toString()} propiedades={propiedades} />;
}

export function CatalogoClient({ propiedades }: { propiedades: Propiedad[] }) {
  return (
    <Suspense>
      <CatalogoKeyed propiedades={propiedades} />
    </Suspense>
  );
}
