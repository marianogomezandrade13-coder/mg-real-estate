"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight, Search, Home, KeyRound, LineChart, Landmark, Phone, Mail, Clock, MapPin, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { Reveal } from "@/components/sitio/Reveal";
import { CountUp } from "@/components/sitio/CountUp";
import { PropertyCard } from "@/components/sitio/PropertyCard";
import type { Propiedad } from "@/lib/propiedades";
import { BRAND, waLink } from "@/lib/brand";
import { cn } from "@/lib/utils";

/* ------------------------------ Datos ------------------------------ */


const FILTROS = [
  { id: "todas", label: "Todas" },
  { id: "venta", label: "Venta" },
  { id: "alquiler", label: "Alquiler" },
  { id: "lote", label: "Terrenos" },
] as const;

const ZONAS = [
  { nombre: "San Martín", texto: "Nuestra casa central. Barrios en expansión, loteos y el mejor acceso al Este mendocino.", q: "San Martín", foto: "/hero-loteo.jpeg", pos: "60% 40%", tono: "from-[#3B4A33] to-[#16201B]" },
  { nombre: "Junín", texto: "Fincas y chacras con valor de suelo en alza. Nueva sucursal.", q: "Junín", tono: "from-[#7E8B62] to-[#1F2C26]" },
  { nombre: "Rivadavia", texto: "Viñedos, tradición vitivinícola y propiedades de gran superficie.", q: "Rivadavia", tono: "from-[#A9834A] to-[#3A2B12]" },
  { nombre: "Luján de Cuyo", texto: "El corazón del vino: casas con jardín, pileta y vista a la cordillera.", q: "Luján de Cuyo", tono: "from-[#5D7050] to-[#16201B]" },
  { nombre: "Ciudad", texto: "Departamentos y oficinas con todos los servicios a pasos.", q: "Ciudad de Mendoza", tono: "from-[#8C7A55] to-[#1F2C26]" },
];

const SERVICIOS = [
  { icon: Home, titulo: "Compra y venta", texto: "Acompañamiento profesional en cada etapa: búsqueda, negociación, boleto y escritura." },
  { icon: KeyRound, titulo: "Administración de alquileres", texto: "Cobros, liquidaciones mensuales, ajustes por ICL y seguimiento del contrato." },
  { icon: LineChart, titulo: "Tasaciones", texto: "Valuación profesional respaldada por el mercado real de Mendoza." },
  { icon: Landmark, titulo: "Emprendimientos", texto: "Lotes, loteos y desarrollos en zonas de alta valorización." },
];

const TITULAR = ["Encontrá", "el", "espacio", "que", "está", "a", "tu", "altura."];

/* ---------------------------- Componentes ---------------------------- */

function Kicker({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p className={cn("text-[11px] font-bold tracking-[0.28em] uppercase mb-3 flex items-center gap-3", light ? "text-gold-light" : "text-gold")}>
      <span className={cn("h-px w-8", light ? "bg-gold-light/60" : "bg-gold/50")} />
      {children}
    </p>
  );
}

/* -------------------------------- Página ------------------------------- */

export function HomeClient({ destacadas }: { destacadas: Propiedad[] }) {
  const router = useRouter();
  const heroRef = useRef<HTMLElement>(null);
  const [operacion, setOperacion] = useState<"comprar" | "alquilar">("comprar");
  const [tipo, setTipo] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["id"]>("todas");
  const [zona, setZona] = useState(0);

  /* Parallax de scroll en el hero (sin re-renders) */
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onScroll = () => el.style.setProperty("--sy", String(Math.min(window.scrollY, 900)));
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Parallax + luz dorada que siguen al cursor */
  const onHeroMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = heroRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", (x - 0.5).toFixed(3));
    el.style.setProperty("--my", (y - 0.5).toFixed(3));
    el.style.setProperty("--px", `${(x * 100).toFixed(1)}%`);
    el.style.setProperty("--py", `${(y * 100).toFixed(1)}%`);
  };

  const buscar = () => {
    const params = new URLSearchParams({ op: operacion === "comprar" ? "venta" : "alquiler" });
    if (tipo) params.set("tipo", tipo);
    if (busqueda.trim()) params.set("q", busqueda.trim());
    router.push(`/catalogo?${params.toString()}`);
  };

  const visibles = destacadas.filter((p) =>
    filtro === "todas" ? true : filtro === "lote" ? p.tipo === "lote" : p.operacion === filtro
  );

  const enviarContacto = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const msg = `Hola, soy ${f.get("nombre")}. ${f.get("mensaje") || "Quisiera recibir más información."} Mi contacto: ${f.get("telefono") || f.get("email") || "-"}`;
    window.open(waLink(msg), "_blank", "noopener,noreferrer");
    toast.success("Te llevamos a WhatsApp para completar tu consulta");
  };

  return (
    <>
      {/* ============================ HERO ============================ */}
      <section
        ref={heroRef}
        onMouseMove={onHeroMove}
        style={{ "--mx": 0, "--my": 0, "--sy": 0, "--px": "70%", "--py": "30%" } as React.CSSProperties}
        className="relative -mt-[64px] min-h-[100svh] bg-forest overflow-hidden flex items-center"
      >
        {/* Foto con parallax (mouse + scroll) */}
        <div className="absolute inset-0 will-change-transform"
          style={{ transform: "translate3d(calc(var(--mx) * -22px), calc(var(--my) * -14px + var(--sy) * 0.22px), 0) scale(1.12)", transition: "transform 0.5s cubic-bezier(.16,1,.3,1)" }}>
          <Image src="/hero-loteo.jpeg" alt="Vista aérea de un loteo en San Martín, Mendoza, al atardecer" fill priority sizes="100vw" className="object-cover object-[70%_50%]" />
        </div>
        {/* Velos: legibilidad + luz dorada que sigue al cursor */}
        <div className="absolute inset-0 bg-gradient-to-r from-forest via-forest/80 to-forest/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-forest via-transparent to-forest/50" />
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(520px circle at var(--px) var(--py), rgba(217,188,133,0.16), transparent 62%)" }} />

        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-[120px] pb-28 w-full">
          <p className="mg-word text-gold-light text-[11px] md:text-[12px] font-bold tracking-[0.3em] uppercase mb-6 flex items-center gap-3"
            style={{ "--mg-delay": "100ms" } as React.CSSProperties}>
            <span className="h-px w-10 bg-gold-light/70" />
            {BRAND.city}
          </p>

          <h1 className="font-display text-white text-[44px] sm:text-[64px] lg:text-[84px] font-medium leading-[1.02] max-w-4xl">
            {TITULAR.map((w, i) => (
              <span key={i} className={cn("mg-word mr-[0.22em]", w === "altura." && "italic text-gold-gradient")}
                style={{ "--mg-delay": `${250 + i * 90}ms` } as React.CSSProperties}>
                {w}
              </span>
            ))}
          </h1>

          <p className="mg-word mt-7 text-white/75 text-[16px] md:text-[18px] max-w-xl leading-relaxed"
            style={{ "--mg-delay": "1100ms" } as React.CSSProperties}>
            Compra, venta, alquiler y tasaciones con el acompañamiento cercano de {BRAND.name}.
          </p>

          {/* Buscador de vidrio */}
          <div className="mg-word mt-10 max-w-4xl" style={{ "--mg-delay": "1300ms" } as React.CSSProperties}>
            <div className="glass rounded-[20px] p-2.5 flex flex-col md:flex-row md:items-stretch gap-2 shadow-elevated">
              {/* Toggle con píldora deslizante */}
              <div role="tablist" aria-label="Operación" className="relative grid grid-cols-2 bg-forest/50 rounded-[13px] p-1 md:w-[210px] shrink-0">
                <span aria-hidden className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-[10px] bg-gold-light transition-transform duration-500"
                  style={{ transform: operacion === "alquilar" ? "translateX(100%)" : "translateX(0)", transitionTimingFunction: "cubic-bezier(.16,1,.3,1)" }} />
                {(["comprar", "alquilar"] as const).map((op) => (
                  <button key={op} role="tab" aria-selected={operacion === op} onClick={() => setOperacion(op)}
                    className={cn("relative z-10 py-3 text-[14px] font-semibold capitalize transition-colors",
                      operacion === op ? "text-forest" : "text-white/80 hover:text-white")}>
                    {op}
                  </button>
                ))}
              </div>

              <label className="relative md:w-[190px] shrink-0 px-4 py-2 rounded-[13px] hover:bg-white/5 transition-colors cursor-pointer">
                <span className="block text-[10px] font-bold tracking-[0.15em] uppercase text-gold-light">Tipo</span>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)}
                  className="w-full appearance-none bg-transparent text-white text-[15px] font-semibold outline-none cursor-pointer pr-6">
                  <option value="" className="text-forest">Todos</option>
                  <option value="casa" className="text-forest">Casa</option>
                  <option value="departamento" className="text-forest">Departamento</option>
                  <option value="lote" className="text-forest">Lote / Terreno</option>
                  <option value="finca" className="text-forest">Finca</option>
                </select>
                <ChevronDown size={15} className="absolute right-4 bottom-3.5 text-white/60 pointer-events-none" />
              </label>

              <label className="flex-1 min-w-0 px-4 py-2 rounded-[13px] hover:bg-white/5 focus-within:bg-white/5 transition-colors">
                <span className="block text-[10px] font-bold tracking-[0.15em] uppercase text-gold-light">¿Dónde buscás?</span>
                <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && buscar()}
                  placeholder="Barrio, ciudad o código"
                  className="w-full bg-transparent text-white text-[15px] font-semibold outline-none placeholder:text-white/40" />
              </label>

              <button onClick={buscar}
                className="group bg-gold-light hover:bg-champagne text-forest font-bold text-[15px] px-7 py-4 rounded-[13px] transition-colors flex items-center justify-center gap-2 whitespace-nowrap">
                <Search size={17} /> Buscar
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px]">
              <span className="text-white/50 mr-1">Explorá:</span>
              {[["Casas", "casa"], ["Departamentos", "departamento"], ["Terrenos", "lote"], ["Fincas", "finca"]].map(([l, t]) => (
                <Link key={t} href={`/catalogo?tipo=${t}`}
                  className="px-3.5 py-1.5 rounded-full border border-white/20 text-white/80 hover:border-gold-light hover:text-gold-light hover:bg-gold-light/10 transition-colors">
                  {l}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Indicador de scroll */}
        <a href="#destacadas" aria-label="Ver propiedades destacadas"
          className="absolute bottom-7 left-1/2 -translate-x-1/2 z-10 hidden md:flex flex-col items-center gap-2 text-white/60 hover:text-gold-light transition-colors">
          <span className="text-[10px] tracking-[0.3em] uppercase">Descubrí</span>
          <span className="relative block w-px h-10 bg-white/20 overflow-hidden">
            <span className="mg-anim absolute inset-x-0 top-0 h-1/2 bg-gold-light" style={{ animation: "mg-scroll-cue 2s cubic-bezier(.65,0,.35,1) infinite" }} />
          </span>
        </a>
      </section>

      {/* ============================ CIFRAS (solo si están confirmadas) ============================ */}
      {BRAND.stats.length > 0 && (
      <section className="bg-forest-2 border-y border-gold-light/10">
        <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8 sm:divide-x divide-white/10">
          {BRAND.stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 120} className="sm:px-8 first:pl-0 text-center sm:text-left">
              <p className="font-display text-[46px] md:text-[54px] font-medium text-gold-gradient leading-none">
                <CountUp to={s.valor} prefix={s.prefijo} />
              </p>
              <p className="mt-2 text-[13px] tracking-wide text-white/60">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </section>
      )}

      {/* ========================== DESTACADAS ========================== */}
      <section id="destacadas" className="max-w-7xl mx-auto px-6 py-24 scroll-mt-16">
        <Reveal className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
          <div>
            <Kicker>Selección</Kicker>
            <h2 className="font-display text-[36px] md:text-[48px] font-medium text-forest leading-tight">Propiedades destacadas</h2>
          </div>
          {destacadas.length > 0 && <div role="tablist" aria-label="Filtrar propiedades" className="flex flex-wrap gap-2">
            {FILTROS.map((f) => (
              <button key={f.id} role="tab" aria-selected={filtro === f.id} onClick={() => setFiltro(f.id)}
                className={cn("px-5 py-2 rounded-full text-[13px] font-semibold border transition-all duration-300",
                  filtro === f.id
                    ? "bg-forest text-gold-light border-forest shadow-card"
                    : "bg-white text-text-secondary border-border-mid hover:border-gold hover:text-gold")}>
                {f.label}
              </button>
            ))}
          </div>}
        </Reveal>

        {destacadas.length === 0 ? (
          <div className="rounded-[24px] border border-border-mid bg-white p-10 sm:p-14 text-center">
            <span className="mx-auto grid place-items-center w-14 h-14 rounded-full bg-gold-bg text-gold"><Home size={24} strokeWidth={1.6} /></span>
            <h3 className="font-display text-[28px] font-medium text-forest mt-5">Estamos preparando nuestra selección</h3>
            <p className="text-text-muted mt-2 max-w-md mx-auto">Muy pronto vas a ver acá las propiedades disponibles. Mientras tanto, contanos qué buscás y te asesoramos.</p>
            <a href={waLink("Hola, quisiera conocer las propiedades disponibles.")} target="_blank" rel="noopener noreferrer"
              className="mt-7 inline-flex items-center gap-2 bg-forest text-gold-light font-bold text-[14px] px-6 py-3 rounded-[12px] hover:bg-forest-3 transition-colors">
              Consultar por WhatsApp <ArrowRight size={16} />
            </a>
          </div>
        ) : visibles.length === 0 ? (
          <p className="text-center text-text-muted py-12">No hay propiedades en esta categoría por ahora. Probá con otra o mirá todo el catálogo.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibles.map((p, i) => (
              <PropertyCard key={`${filtro}-${p.codigo}`} p={p} index={i} />
            ))}
          </div>
        )}

        <Reveal className="mt-12 text-center">
          <Link href="/catalogo" className="group inline-flex items-center gap-2 text-[14px] font-bold text-forest border-b-2 border-gold-light hover:border-gold pb-1 transition-colors">
            Ver todo el catálogo <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </Reveal>
      </section>

      {/* ============================= ZONAS ============================= */}
      <section className="bg-app-bg py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <Reveal className="mb-10 max-w-2xl">
            <Kicker>Explorá por zona</Kicker>
            <h2 className="font-display text-[36px] md:text-[48px] font-medium text-forest leading-tight">Conocemos cada rincón de Mendoza</h2>
          </Reveal>

          <div className="flex flex-col lg:flex-row gap-3 lg:h-[460px]">
            {ZONAS.map((z, i) => {
              const activa = zona === i;
              return (
                <div key={z.nombre} onMouseEnter={() => setZona(i)} onFocus={() => setZona(i)} onClick={() => setZona(i)}
                  className={cn("group relative overflow-hidden rounded-[20px] text-left cursor-pointer transition-[flex,height] duration-700 ease-[cubic-bezier(.16,1,.3,1)]",
                    activa ? "lg:flex-[4.5] h-[270px] lg:h-auto" : "lg:flex-1 h-[88px] lg:h-auto")}>
                  <div className={cn("absolute inset-0 bg-gradient-to-br", z.tono)} />
                  {z.foto && (
                    <Image src={z.foto} alt="" fill sizes="(min-width:1024px) 50vw, 100vw"
                      className={cn("object-cover transition-all duration-700", activa ? "opacity-70 scale-100" : "opacity-30 scale-110")}
                      style={{ objectPosition: z.pos }} />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-forest/90 via-forest/25 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-6">
                    <p className="text-[10px] font-mono tracking-[0.25em] text-gold-light/80 mb-1">0{i + 1}</p>
                    <h3 className={cn("font-display text-white font-medium leading-tight transition-all duration-500",
                      activa ? "text-[32px]" : "text-[22px]")}>
                      {z.nombre}
                    </h3>
                    <div className={cn("grid transition-all duration-700", activa ? "grid-rows-[1fr] opacity-100 mt-3" : "grid-rows-[0fr] opacity-0")}>
                      <div className="overflow-hidden">
                        <p className="text-[14px] text-white/75 max-w-sm leading-relaxed">{z.texto}</p>
                        <Link href={`/catalogo?q=${encodeURIComponent(z.q)}`} tabIndex={activa ? 0 : -1}
                          className="mt-4 inline-flex items-center gap-2 text-[13px] font-bold text-gold-light hover:text-white transition-colors">
                          Ver propiedades <ArrowRight size={15} />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================== SERVICIOS =========================== */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <Reveal className="mb-12 max-w-2xl">
          <Kicker>Servicios</Kicker>
          <h2 className="font-display text-[36px] md:text-[48px] font-medium text-forest leading-tight">Todo lo que tu operación necesita</h2>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {SERVICIOS.map((s, i) => (
            <Reveal key={s.titulo} delay={i * 110}>
              <div className="group h-full relative bg-white rounded-[20px] border border-border-light p-7 overflow-hidden hover:border-gold-light hover:shadow-elevated hover:-translate-y-1 transition-all duration-500">
                <span className="absolute -right-2 -top-4 font-display text-[92px] font-semibold text-gold-bg leading-none select-none group-hover:text-champagne/60 transition-colors">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="relative grid place-items-center w-12 h-12 rounded-[14px] bg-gold-bg text-gold group-hover:bg-forest group-hover:text-gold-light transition-colors duration-500">
                  <s.icon size={22} strokeWidth={1.7} />
                </span>
                <h3 className="relative mt-6 text-[17px] font-bold text-text-primary">{s.titulo}</h3>
                <p className="relative mt-2 text-[14px] text-text-muted leading-relaxed">{s.texto}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============================ TASACIÓN ============================ */}
      <section id="tasacion" className="relative bg-forest overflow-hidden scroll-mt-16">
        <Image src="/hero-loteo.jpeg" alt="" fill sizes="100vw" className="object-cover opacity-20 mix-blend-luminosity" />
        <div className="absolute inset-0 bg-gradient-to-r from-forest via-forest/90 to-forest/60" />
        <div className="relative max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-[1.3fr_1fr] gap-10 items-center">
          <Reveal>
            <Kicker light>Tasaciones profesionales</Kicker>
            <h2 className="font-display text-white text-[36px] md:text-[54px] font-medium leading-[1.05]">
              ¿Cuánto vale <span className="italic text-gold-gradient">realmente</span> tu propiedad?
            </h2>
            <p className="mt-5 text-white/70 text-[16px] max-w-xl leading-relaxed">
              Nuestros tasadores relevan tu inmueble, analizan el mercado de la zona y te entregan un informe profesional con valor mínimo, recomendado y óptimo de publicación.
            </p>
          </Reveal>
          <Reveal delay={150} className="lg:justify-self-end">
            <a href={waLink("Hola, quiero solicitar la tasación profesional de mi propiedad.")} target="_blank" rel="noopener noreferrer"
              className="group inline-flex items-center gap-3 bg-gold-light hover:bg-champagne text-forest font-bold text-[16px] px-8 py-4 rounded-[14px] transition-colors shadow-elevated">
              Solicitar tasación
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1.5" />
            </a>
            <p className="mt-3 text-[12px] text-white/45">Te respondemos por WhatsApp en el día.</p>
          </Reveal>
        </div>
      </section>

      {/* ============================ CONTACTO ============================ */}
      <section id="contacto" className="max-w-7xl mx-auto px-6 py-24 scroll-mt-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-start">
          <Reveal>
            <Kicker>Contacto</Kicker>
            <h2 className="font-display text-[36px] md:text-[48px] font-medium text-forest leading-tight">Hablemos de tu próxima propiedad</h2>
            <p className="mt-4 text-text-muted text-[16px] max-w-md">Contanos qué buscás y te acompañamos desde la primera visita hasta la escritura.</p>
            <ul className="mt-9 space-y-5 text-[15px] text-text-secondary">
              {[
                { Icon: MapPin, txt: BRAND.address },
                { Icon: Phone, txt: BRAND.phoneDisplay },
                { Icon: Mail, txt: BRAND.email },
                { Icon: Clock, txt: BRAND.hours },
              ].map(({ Icon, txt }) => (
                <li key={txt} className="flex items-start gap-4">
                  <span className="grid place-items-center w-10 h-10 rounded-full bg-gold-bg text-gold shrink-0"><Icon size={17} /></span>
                  <span className="pt-2 break-words min-w-0">{txt}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={120}>
            <form onSubmit={enviarContacto} className="bg-white rounded-[24px] border border-border-light p-8 space-y-5 shadow-card">
              {[
                { name: "nombre", label: "Nombre completo", type: "text", req: true },
                { name: "email", label: "Email", type: "email", req: false },
                { name: "telefono", label: "Teléfono", type: "tel", req: false },
              ].map(({ name, label, type, req }) => (
                <div key={name}>
                  <label htmlFor={`c-${name}`} className="block text-[12px] font-semibold tracking-wide text-text-secondary mb-1.5">{label}</label>
                  <input id={`c-${name}`} name={name} type={type} required={req}
                    className="w-full h-12 bg-app-bg-tint border border-border-mid rounded-[11px] px-4 text-[14px] outline-none focus:border-gold focus:ring-4 focus:ring-gold/15 transition-all" />
                </div>
              ))}
              <div>
                <label htmlFor="c-mensaje" className="block text-[12px] font-semibold tracking-wide text-text-secondary mb-1.5">Mensaje</label>
                <textarea id="c-mensaje" name="mensaje" rows={3}
                  className="w-full bg-app-bg-tint border border-border-mid rounded-[11px] px-4 py-3 text-[14px] outline-none focus:border-gold focus:ring-4 focus:ring-gold/15 transition-all resize-none" />
              </div>
              <button type="submit"
                className="group w-full py-3.5 bg-forest hover:bg-forest-3 text-gold-light font-bold text-[15px] rounded-[12px] transition-colors flex items-center justify-center gap-2">
                Enviar consulta <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </button>
            </form>
          </Reveal>
        </div>
      </section>
    </>
  );
}
