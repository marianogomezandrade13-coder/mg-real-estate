import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { PropertyCard } from "@/components/sitio/PropertyCard";
import { listarPublicadas } from "@/lib/propiedades-db";
import { propiedadesDeZona, zonasDe } from "@/lib/seo-paginas";

type Params = { params: Promise<{ slug: string }> };

export const revalidate = 60;
export const dynamicParams = true; // una zona nueva aparece sola cuando se publica su primera propiedad

export async function generateStaticParams() {
  return zonasDe(await listarPublicadas()).map((z) => ({ slug: z.slug }));
}

async function datos(slug: string) {
  const todas = await listarPublicadas();
  const zona = zonasDe(todas).find((z) => z.slug === slug);
  return { zona, lista: zona ? propiedadesDeZona(todas, slug) : [], otras: zonasDe(todas).filter((z) => z.slug !== slug) };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { zona } = await datos((await params).slug);
  if (!zona) return { title: "Zona no encontrada" };
  return {
    title: `Propiedades en ${zona.nombre}, Mendoza`,
    description: `Casas, departamentos, lotes y más en venta y alquiler en ${zona.nombre}, Mendoza. Fotos, precios y datos reales con MG Real Estate.`,
    alternates: { canonical: `/zona/${(await params).slug}` },
  };
}

export default async function PaginaZona({ params }: Params) {
  const slug = (await params).slug;
  const { zona, lista, otras } = await datos(slug);
  if (!zona) notFound();

  return (
    <>
      <section className="bg-forest border-b border-gold-light/10">
        <div className="max-w-7xl mx-auto px-6 pt-10 pb-12">
          <nav aria-label="Migas de pan" className="text-[12px] text-white/50 flex items-center gap-1.5 mb-5 flex-wrap">
            <Link href="/" className="hover:text-gold-light transition-colors">Inicio</Link>
            <ChevronRight size={12} />
            <Link href="/catalogo" className="hover:text-gold-light transition-colors">Catálogo</Link>
            <ChevronRight size={12} />
            <span className="text-white/80 font-semibold">{zona.nombre}</span>
          </nav>
          <h1 className="font-display text-white text-[36px] md:text-[52px] font-medium leading-[1.05] text-balance">
            Propiedades en <span className="text-gold-gradient italic">{zona.nombre}, Mendoza</span>
          </h1>
          <p className="text-white/65 mt-4 max-w-2xl leading-relaxed">
            {lista.length} {lista.length === 1 ? "propiedad disponible" : "propiedades disponibles"} en {zona.nombre}. Todas con fotos y datos reales, y con atención personalizada de MG Real Estate.
          </p>
        </div>
      </section>
      <div className="bg-app-bg">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {lista.map((p, i) => <PropertyCard key={p.codigo} p={p} index={i} />)}
          </div>
          {otras.length > 0 && (
            <section className="mt-14">
              <h2 className="font-display text-[26px] font-medium text-forest mb-4">Otras zonas</h2>
              <ul className="flex flex-wrap gap-2.5">
                {otras.map((o) => (
                  <li key={o.slug}><Link href={`/zona/${o.slug}`} className="inline-block px-4 py-2 rounded-full bg-white border border-border-mid text-[13px] font-semibold text-text-secondary hover:border-gold hover:text-gold transition-colors">{o.nombre}</Link></li>
                ))}
                <li><Link href="/catalogo" className="inline-block px-4 py-2 rounded-full bg-forest text-[13px] font-semibold text-gold-light">Ver todo el catálogo</Link></li>
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
