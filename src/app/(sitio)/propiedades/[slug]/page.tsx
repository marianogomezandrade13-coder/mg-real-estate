import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, MessageCircle, Bell } from "lucide-react";
import { PropertyCard } from "@/components/sitio/PropertyCard";
import { listarPublicadas } from "@/lib/propiedades-db";
import { rutaPropiedad } from "@/lib/propiedades";
import { COMBINACIONES, combinacionDesdeSlug, rutaSeo, textosSeo } from "@/lib/seo-paginas";
import { BRAND, waLink } from "@/lib/brand";

type Params = { params: Promise<{ slug: string }> };

export const revalidate = 60;
export const dynamicParams = false; // solo existen las combinaciones tipo + operación definidas

export function generateStaticParams() {
  return COMBINACIONES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const c = combinacionDesdeSlug((await params).slug);
  if (!c) return {};
  const t = textosSeo(c.tipo, c.operacion);
  const hay = (await listarPublicadas()).some((p) => p.tipo === c.tipo && p.operacion === c.operacion);
  return {
    title: t.titulo,
    description: t.descripcion,
    alternates: { canonical: rutaSeo(c.tipo, c.operacion) },
    // Una página sin propiedades no aporta a Google: se mantiene visible para personas pero no se indexa.
    robots: hay ? undefined : { index: false, follow: true },
  };
}

export default async function PaginaSeo({ params }: Params) {
  const c = combinacionDesdeSlug((await params).slug);
  if (!c) notFound();
  const t = textosSeo(c.tipo, c.operacion);
  const lista = (await listarPublicadas()).filter((p) => p.tipo === c.tipo && p.operacion === c.operacion);
  const otras = COMBINACIONES.filter((o) => o.slug !== c.slug && o.operacion === c.operacion);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t.titulo,
    itemListElement: lista.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://mgrealestate.vercel.app"}${rutaPropiedad(p.codigo)}`, name: p.titulo })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <section className="bg-forest border-b border-gold-light/10">
        <div className="max-w-7xl mx-auto px-6 pt-10 pb-12">
          <nav aria-label="Migas de pan" className="text-[12px] text-white/50 flex items-center gap-1.5 mb-5 flex-wrap">
            <Link href="/" className="hover:text-gold-light transition-colors">Inicio</Link>
            <ChevronRight size={12} />
            <Link href="/catalogo" className="hover:text-gold-light transition-colors">Catálogo</Link>
            <ChevronRight size={12} />
            <span className="text-white/80 font-semibold">{t.h1}</span>
          </nav>
          <h1 className="font-display text-white text-[36px] md:text-[52px] font-medium leading-[1.05] text-balance">
            {t.h1} <span className="text-gold-gradient italic">en San Martín, Mendoza</span>
          </h1>
          <p className="text-white/65 mt-4 max-w-2xl leading-relaxed">{t.intro}</p>
        </div>
      </section>

      <div className="bg-app-bg">
        <div className="max-w-7xl mx-auto px-6 py-12">
          {lista.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {lista.map((p, i) => <PropertyCard key={p.codigo} p={p} index={i} />)}
            </div>
          ) : (
            <div className="bg-white rounded-[24px] border border-border-light p-12 text-center">
              <h2 className="font-display text-[28px] font-medium text-forest">Por ahora no tenemos {t.h1.toLowerCase()} publicados</h2>
              <p className="text-[14px] text-text-muted mt-2 max-w-md mx-auto">Muchas propiedades se conocen antes de publicarse. Contanos qué buscás y te avisamos apenas aparezca algo.</p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link href="/contacto?asunto=alerta" className="inline-flex items-center gap-2 px-6 py-3 rounded-[12px] bg-forest text-gold-light text-[14px] font-bold hover:bg-forest-3 transition-colors"><Bell size={16} />Avisarme cuando haya</Link>
                <a href={waLink(`Hola, busco ${t.h1.toLowerCase()} en Mendoza. ¿Tienen algo disponible?`)} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-[12px] border border-gold text-gold text-[14px] font-bold hover:bg-gold-bg transition-colors"><MessageCircle size={16} />Consultar por WhatsApp</a>
              </div>
            </div>
          )}

          <section className="mt-14">
            <h2 className="font-display text-[26px] font-medium text-forest mb-4">Seguí explorando</h2>
            <ul className="flex flex-wrap gap-2.5">
              {otras.map((o) => (
                <li key={o.slug}>
                  <Link href={`/propiedades/${o.slug}`} className="inline-block px-4 py-2 rounded-full bg-white border border-border-mid text-[13px] font-semibold text-text-secondary hover:border-gold hover:text-gold transition-colors">
                    {textosSeo(o.tipo, o.operacion).h1}
                  </Link>
                </li>
              ))}
              <li><Link href="/catalogo" className="inline-block px-4 py-2 rounded-full bg-forest text-[13px] font-semibold text-gold-light">Ver todo el catálogo</Link></li>
            </ul>
            <p className="mt-8 text-[13px] text-text-muted">{BRAND.name} · {BRAND.address}</p>
          </section>
        </div>
      </div>
    </>
  );
}
