"use client";

import Link from "next/link";
import { Heart, ChevronRight } from "lucide-react";
import { PropertyCard } from "@/components/sitio/PropertyCard";
import { useFavoritos } from "@/components/sitio/useFavoritos";
import type { Propiedad } from "@/lib/propiedades";

export function FavoritosClient({ propiedades }: { propiedades: Propiedad[] }) {
  const { favs } = useFavoritos();
  const guardadas = propiedades.filter((p) => favs.includes(p.codigo));

  return (
    <div className="bg-app-bg min-h-[60vh]">
      <section className="bg-forest border-b border-gold-light/10">
        <div className="max-w-7xl mx-auto px-6 pt-10 pb-12">
          <nav aria-label="Migas de pan" className="text-[12px] text-white/50 flex items-center gap-1.5 mb-5">
            <Link href="/" className="hover:text-gold-light transition-colors">Inicio</Link>
            <ChevronRight size={12} />
            <span className="text-white/80 font-semibold">Favoritos</span>
          </nav>
          <p className="text-gold-light text-[11px] font-bold tracking-[0.28em] uppercase mb-3 flex items-center gap-3">
            <span className="h-px w-8 bg-gold-light/60" />Favoritos
          </p>
          <h1 className="font-display text-white text-[40px] md:text-[56px] font-medium leading-none">
            Tus propiedades <span className="text-gold-gradient italic">guardadas</span>
          </h1>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-10">
        {guardadas.length === 0 ? (
          <div className="bg-white rounded-[24px] border border-border-light p-12 text-center">
            <span className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-gold-bg text-gold"><Heart size={28} strokeWidth={1.5} /></span>
            <h2 className="font-display text-[28px] font-medium text-forest mt-6">Todavía no guardaste ninguna propiedad</h2>
            <p className="text-[14px] text-text-muted mt-2 max-w-md mx-auto">
              Tocá el corazón en cualquier propiedad del catálogo para guardarla acá.
            </p>
            <Link href="/catalogo" className="mt-7 inline-flex px-6 py-3 rounded-[12px] bg-forest text-gold-light text-[14px] font-bold hover:bg-forest-3 transition-colors">
              Ver catálogo
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {guardadas.map((p, i) => <PropertyCard key={p.codigo} p={p} index={i} />)}
          </div>
        )}
      </div>
    </div>
  );
}
