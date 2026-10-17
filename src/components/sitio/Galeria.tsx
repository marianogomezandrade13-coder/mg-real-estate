"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X, Expand } from "lucide-react";
import { PropertyVisual } from "./PropertyVisual";
import type { Propiedad } from "@/lib/propiedades";
import { cn } from "@/lib/utils";

/** Galería de la ficha: foto grande + miniaturas + visor a pantalla completa (teclado y gestos táctiles). */
export function Galeria({ p }: { p: Pick<Propiedad, "fotos" | "tono" | "tipo" | "titulo" | "codigo" | "operacion"> }) {
  const fotos = p.fotos;
  const [i, setI] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const [touchX, setTouchX] = useState<number | null>(null);

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
      <span className="absolute top-5 left-5 bg-forest/85 backdrop-blur text-gold-light text-[11px] font-bold tracking-[0.18em] px-3.5 py-1.5 rounded-full uppercase">{p.operacion}</span>
      <span className="absolute bottom-5 left-5 text-white/90 text-[12px] font-mono tracking-wide">{p.codigo}</span>
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
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_1fr] gap-3 mb-10">
        <button type="button" onClick={() => setAbierto(true)} aria-label="Ver fotos a pantalla completa"
          className="group relative h-[300px] sm:h-[420px] lg:h-[500px] rounded-[24px] overflow-hidden bg-forest-2 text-left">
          <Image src={fotos[i]} alt={`${p.titulo} — foto ${i + 1} de ${fotos.length}`} fill priority sizes="(min-width:1024px) 75vw, 100vw"
            className="object-cover transition-transform duration-[900ms] group-hover:scale-105" />
          {insignias}
          <span className="absolute bottom-5 right-5 inline-flex items-center gap-2 bg-white/90 text-forest text-[12px] font-semibold px-3.5 py-2 rounded-full">
            <Expand size={14} />{fotos.length} {fotos.length === 1 ? "foto" : "fotos"}
          </span>
        </button>

        {fotos.length > 1 && (
          <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-visible lg:h-[500px] pb-1 lg:pb-0">
            {miniaturas.map((f, k) => (
              <button key={f} type="button" onClick={() => setI(k)} aria-label={`Ver foto ${k + 1}`} aria-current={k === i}
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
        <div role="dialog" aria-modal="true" aria-label="Galería de fotos" className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center"
          onClick={() => setAbierto(false)}
          onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
          onTouchEnd={(e) => { if (touchX !== null) { const dx = e.changedTouches[0].clientX - touchX; if (Math.abs(dx) > 50) ir(dx < 0 ? 1 : -1); } setTouchX(null); }}>
          <button onClick={() => setAbierto(false)} aria-label="Cerrar" className="absolute top-4 right-4 grid place-items-center w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/20 z-10"><X size={22} /></button>
          {fotos.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); ir(-1); }} aria-label="Foto anterior" className="absolute left-3 sm:left-6 grid place-items-center w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/20 z-10"><ChevronLeft size={24} /></button>
              <button onClick={(e) => { e.stopPropagation(); ir(1); }} aria-label="Foto siguiente" className="absolute right-3 sm:right-6 grid place-items-center w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/20 z-10"><ChevronRight size={24} /></button>
            </>
          )}
          <div className="relative w-full h-full max-w-6xl max-h-[86vh] mx-4" onClick={(e) => e.stopPropagation()}>
            <Image src={fotos[i]} alt={`${p.titulo} — foto ${i + 1} de ${fotos.length}`} fill sizes="100vw" className="object-contain" />
          </div>
          <p className="absolute bottom-5 inset-x-0 text-center text-white/70 text-[13px]">{i + 1} / {fotos.length}</p>
        </div>
      )}
    </>
  );
}
