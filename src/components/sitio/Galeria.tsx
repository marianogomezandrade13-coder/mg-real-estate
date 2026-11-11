"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X, Expand } from "lucide-react";
import { PropertyVisual } from "./PropertyVisual";
import type { Propiedad } from "@/lib/propiedades";
import { cn } from "@/lib/utils";

/**
 * Carrusel con scroll nativo (scroll-snap): el dedo arrastra la foto con inercia y siempre queda
 * una foto entera centrada. El índice se deduce de la posición del scroll, así que nunca se
 * desincroniza con lo que se ve.
 */
function Pista({ fotos, indice, onIndice, alt, ajuste, className, onAbrir, prioridad, instantaneo }: {
  fotos: string[]; indice: number; onIndice: (i: number) => void; alt: string; ajuste: "cover" | "contain";
  className?: string; onAbrir?: () => void; prioridad?: boolean; instantaneo?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const actual = useRef(indice);
  const desdeScroll = useRef(-1);
  useEffect(() => { actual.current = indice; }, [indice]);

  const alinear = useCallback((i: number, suave: boolean) => {
    const el = ref.current;
    if (!el) return;
    const destino = i * el.clientWidth;
    const lejos = Math.abs(el.scrollLeft - destino) > el.clientWidth * 1.5; // saltos largos (de la última a la primera): sin animar
    if (Math.abs(el.scrollLeft - destino) > 1) el.scrollTo({ left: destino, behavior: suave && !lejos ? "smooth" : "auto" });
  }, []);

  // Cambios desde afuera (flechas, miniaturas, teclado): mover el scroll hasta esa foto.
  // Si el cambio nació del propio scroll del usuario, no se vuelve a mover (pelearía con su gesto).
  useEffect(() => {
    if (desdeScroll.current === indice) { desdeScroll.current = -1; return; }
    alinear(indice, !instantaneo);
  }, [indice, alinear, instantaneo]);

  // Al rotar el celular o cambiar el tamaño, mantener la misma foto centrada.
  useEffect(() => {
    const onResize = () => alinear(actual.current, false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [alinear]);

  const alScroll = () => {
    const el = ref.current;
    if (!el || el.clientWidth === 0) return;
    const i = Math.min(fotos.length - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth)));
    if (i !== actual.current) { actual.current = i; desdeScroll.current = i; onIndice(i); }
  };

  return (
    <div ref={ref} onScroll={alScroll} onClick={onAbrir}
      className={cn("flex overflow-x-auto snap-x snap-mandatory overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}>
      {fotos.map((f, k) => (
        <div key={f} className="relative shrink-0 grow-0 basis-full h-full snap-center snap-always">
          <Image src={f} alt={`${alt} — foto ${k + 1} de ${fotos.length}`} fill draggable={false}
            {...(prioridad && k === 0 ? { priority: true } : { loading: Math.abs(k - indice) <= 1 ? ("eager" as const) : ("lazy" as const) })}
            sizes={ajuste === "cover" ? "(min-width:1024px) 75vw, 100vw" : "100vw"}
            className={cn("select-none", ajuste === "cover" ? "object-cover" : "object-contain")} />
        </div>
      ))}
    </div>
  );
}

/** Galería de la ficha: foto grande deslizable + miniaturas + visor a pantalla completa. */
export function Galeria({ p }: { p: Pick<Propiedad, "fotos" | "tono" | "tipo" | "titulo" | "codigo" | "operacion"> }) {
  const fotos = p.fotos;
  const [i, setI] = useState(0);
  const [abierto, setAbierto] = useState(false);

  const ir = useCallback((d: number) => setI((v) => (v + d + fotos.length) % fotos.length), [fotos.length]);

  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
      if (e.key === "ArrowRight") ir(1);
      if (e.key === "ArrowLeft") ir(-1);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [abierto, ir]);

  const insignias = (
    <>
      <div className="absolute inset-0 bg-gradient-to-t from-forest/50 via-transparent to-transparent pointer-events-none" />
      <span className="absolute top-5 left-5 bg-forest/85 backdrop-blur text-gold-light text-[11px] font-bold tracking-[0.18em] px-3.5 py-1.5 rounded-full uppercase pointer-events-none">{p.operacion}</span>
      <span className="absolute bottom-5 left-5 text-white/90 text-[12px] font-mono tracking-wide pointer-events-none">{p.codigo}</span>
    </>
  );

  // Sin fotos: placeholder de la paleta (tres bloques como antes)
  if (fotos.length === 0) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-3 mb-10">
        <PropertyVisual p={p} sizes="(min-width:1024px) 66vw, 100vw" iconSize={96} className="group h-[300px] sm:h-[420px] lg:h-[480px] rounded-[24px]">{insignias}</PropertyVisual>
        <div className="hidden lg:grid grid-rows-2 gap-3">
          <PropertyVisual p={p} sizes="33vw" iconSize={44} className="group rounded-[24px] bg-gradient-to-tr" />
          <PropertyVisual p={p} sizes="33vw" iconSize={44} className="group rounded-[24px] bg-gradient-to-bl" />
        </div>
      </div>
    );
  }

  const miniaturas = fotos.slice(0, 5);
  const flecha = "absolute top-1/2 -translate-y-1/2 grid place-items-center w-10 h-10 rounded-full bg-white/85 text-forest shadow-md hover:bg-white transition-opacity";
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_1fr] gap-3 mb-10">
        <div
          role="group" aria-roledescription="carrusel" aria-label={`Fotos de ${p.titulo}`} tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); setAbierto(true); }
            if (e.key === "ArrowRight") ir(1);
            if (e.key === "ArrowLeft") ir(-1);
          }}
          className="group relative h-[300px] sm:h-[420px] lg:h-[500px] rounded-[24px] overflow-hidden bg-forest-2 cursor-zoom-in focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold/40">
          <Pista fotos={fotos} indice={i} onIndice={setI} alt={p.titulo} ajuste="cover" prioridad onAbrir={() => setAbierto(true)} className="h-full w-full" />
          {insignias}
          {fotos.length > 1 && (
            <>
              <button type="button" onClick={() => ir(-1)} aria-label="Foto anterior" className={cn(flecha, "left-3 lg:opacity-0 lg:group-hover:opacity-100")}><ChevronLeft size={20} /></button>
              <button type="button" onClick={() => ir(1)} aria-label="Foto siguiente" className={cn(flecha, "right-3 lg:opacity-0 lg:group-hover:opacity-100")}><ChevronRight size={20} /></button>
              <span className="absolute top-5 right-5 bg-forest/80 backdrop-blur text-white text-[12px] font-semibold px-3 py-1.5 rounded-full tabular-nums pointer-events-none" aria-live="polite">{i + 1} / {fotos.length}</span>
            </>
          )}
          <span className="absolute bottom-5 right-5 inline-flex items-center gap-2 bg-white/90 text-forest text-[12px] font-semibold px-3.5 py-2 rounded-full pointer-events-none">
            <Expand size={14} />{fotos.length} {fotos.length === 1 ? "foto" : "fotos"}
          </span>
        </div>

        {fotos.length > 1 && (
          <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-visible lg:h-[500px] pb-1 lg:pb-0">
            {miniaturas.map((f, k) => (
              <button key={f} type="button" onClick={() => { setI(k); if (k === miniaturas.length - 1 && fotos.length > miniaturas.length) setAbierto(true); }} aria-label={`Ver foto ${k + 1}`} aria-current={k === i}
                className={cn("relative shrink-0 w-[110px] h-[80px] lg:w-full lg:h-auto lg:flex-1 rounded-[16px] overflow-hidden border-2 transition-all",
                  k === i ? "border-gold" : "border-transparent opacity-80 hover:opacity-100")}>
                <Image src={f} alt="" fill sizes="(min-width:1024px) 25vw, 110px" className="object-cover" />
                {k === miniaturas.length - 1 && fotos.length > miniaturas.length && (
                  <span className="absolute inset-0 grid place-items-center bg-forest/70 text-white text-[15px] font-bold">+{fotos.length - miniaturas.length + 1}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {abierto && (
        <div role="dialog" aria-modal="true" aria-label="Galería de fotos" className="fixed inset-0 z-[70] bg-black/95">
          <button onClick={() => setAbierto(false)} aria-label="Cerrar" className="absolute top-4 right-4 grid place-items-center w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/20 z-10"><X size={22} /></button>
          <Pista fotos={fotos} indice={i} onIndice={setI} alt={p.titulo} ajuste="contain" instantaneo className="absolute inset-x-0 top-14 bottom-14 sm:inset-x-16" />
          {fotos.length > 1 && (
            <>
              <button onClick={() => ir(-1)} aria-label="Foto anterior" className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 grid place-items-center w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/20 z-10"><ChevronLeft size={24} /></button>
              <button onClick={() => ir(1)} aria-label="Foto siguiente" className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 grid place-items-center w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/20 z-10"><ChevronRight size={24} /></button>
            </>
          )}
          <p className="absolute bottom-5 inset-x-0 text-center text-white/70 text-[13px] pointer-events-none">{i + 1} / {fotos.length}</p>
        </div>
      )}
    </>
  );
}
