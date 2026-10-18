"use client";

import Link from "next/link";
import { MapPin, BedDouble, Bath, Maximize2, ArrowUpRight, Heart } from "lucide-react";
import { PropertyVisual } from "./PropertyVisual";
import { useFavoritos } from "./useFavoritos";
import { m2Tarjeta, rutaPropiedad, type Propiedad } from "@/lib/propiedades";
import { cn } from "@/lib/utils";

export function PropertyCard({ p, index = 0, className }: { p: Propiedad; index?: number; className?: string }) {
  const { isFav, toggle } = useFavoritos();
  const fav = isFav(p.codigo);

  return (
    <article
      className={cn(
        "group relative bg-white rounded-[20px] border border-border-light overflow-hidden hover:-translate-y-1.5 hover:shadow-elevated transition-all duration-500",
        className
      )}
      style={{ animation: `mg-rise 0.7s cubic-bezier(.16,1,.3,1) ${Math.min(index, 8) * 70}ms both` }}
    >
      <Link href={rutaPropiedad(p.codigo)} className="block" aria-label={`${p.titulo}, ${p.precio}`}>
        <PropertyVisual p={p} className="h-56" sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw">
          <div className="absolute inset-0 bg-gradient-to-t from-forest/55 via-transparent to-transparent" />
          <span className="absolute top-4 left-4 bg-forest/85 backdrop-blur text-gold-light text-[10px] font-bold tracking-[0.16em] px-3 py-1.5 rounded-full uppercase">
            {p.operacion}
          </span>
          <span className="absolute bottom-4 left-4 text-white/90 text-[11px] font-mono tracking-wide">{p.codigo}</span>
          <span className="absolute bottom-4 right-4 grid place-items-center w-9 h-9 rounded-full bg-white/90 text-forest opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500">
            <ArrowUpRight size={17} />
          </span>
        </PropertyVisual>
        <div className="p-6">
          <p className="font-display text-[30px] font-semibold text-gold leading-none">{p.precio}</p>
          <h3 className="mt-3 text-[16px] font-bold text-text-primary group-hover:text-gold transition-colors line-clamp-2">{p.titulo}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-text-muted"><MapPin size={13} className="shrink-0" />{p.ubicacion}</p>
          <div className="mt-5 pt-4 border-t border-border-light flex items-center gap-5 text-[13px] text-text-secondary">
            {p.dormitorios > 0 && <span className="flex items-center gap-1.5"><BedDouble size={15} className="text-gold" />{p.dormitorios} dorm</span>}
            {p.banos > 0 && <span className="flex items-center gap-1.5"><Bath size={15} className="text-gold" />{p.banos}</span>}
            <span className="flex items-center gap-1.5"><Maximize2 size={14} className="text-gold" />{m2Tarjeta(p).toLocaleString("es-AR")} m²</span>
          </div>
        </div>
      </Link>
      <button
        onClick={() => toggle(p.codigo)}
        aria-pressed={fav}
        aria-label={fav ? "Quitar de favoritos" : "Guardar en favoritos"}
        className="absolute top-3.5 right-4 grid place-items-center w-9 h-9 rounded-full bg-white/90 backdrop-blur hover:scale-110 transition-transform"
      >
        <Heart size={17} className={cn("transition-colors", fav ? "fill-danger text-danger" : "text-forest")} />
      </button>
    </article>
  );
}
