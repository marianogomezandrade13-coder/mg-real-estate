import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  MapPin, BedDouble, Bath, Ruler, Home, Calendar, Car, DoorOpen, Check, ChevronRight, MessageCircle, Phone, CalendarCheck,
} from "lucide-react";
import { Galeria } from "@/components/sitio/Galeria";
import { PropertyCard } from "@/components/sitio/PropertyCard";
import { FavButton } from "@/components/sitio/FavButton";
import { ShareButton } from "@/components/sitio/ShareButton";
import { similares, mapaEmbedUrl, codigoDesdeRuta } from "@/lib/propiedades";
import { listarPublicadas } from "@/lib/propiedades-db";
import { BRAND, waLink } from "@/lib/brand";

type Params = { params: Promise<{ code: string }> };

// Se regenera cada 60 s y al instante cuando el panel publica o cambia una propiedad.
export const revalidate = 60;
export const dynamicParams = true; // las propiedades nuevas se generan al primer pedido

export async function generateStaticParams() {
  return (await listarPublicadas()).map((p) => ({ code: p.codigo }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const code = codigoDesdeRuta((await params).code);
  const p = (await listarPublicadas()).find((x) => x.codigo === code);
  if (!p) return { title: "Propiedad no encontrada" };
  const desc = p.descripcion ? ` ${p.descripcion.slice(0, 110)}…` : "";
  return {
    title: `${p.titulo} · ${p.codigo}`,
    description: `${p.titulo} en ${p.ubicacion}. ${p.precio}.${desc}`,
    openGraph: { title: p.titulo, description: `${p.precio} · ${p.ubicacion}`, images: p.foto ? [{ url: p.foto }] : undefined },
  };
}

export default async function PropiedadDetallePage({ params }: Params) {
  const code = codigoDesdeRuta((await params).code);
  const todas = await listarPublicadas();
  const p = todas.find((x) => x.codigo === code);
  if (!p) notFound();

  const waConsulta = waLink(`Hola, estoy interesado/a en la propiedad ${p.codigo} (${p.titulo}). ¿Podrían brindarme más información?`);
  const waVisita = waLink(`Hola, quisiera agendar una visita a la propiedad ${p.codigo} (${p.titulo}).`);

  const caracteristicas = [
    { icon: BedDouble, label: "Dormitorios", value: p.dormitorios },
    { icon: Bath, label: "Baños", value: p.banos },
    { icon: DoorOpen, label: "Ambientes", value: p.ambientes },
    { icon: Car, label: "Cocheras", value: p.cocheras },
    { icon: Home, label: "M² cubiertos", value: p.m2Cubiertos ? `${p.m2Cubiertos.toLocaleString("es-AR")} m²` : 0 },
    { icon: Ruler, label: p.tipo === "lote" || p.tipo === "finca" ? "Superficie" : "M² totales", value: p.m2Totales ? `${p.m2Totales.toLocaleString("es-AR")} m²` : 0 },
    { icon: Calendar, label: "Antigüedad", value: p.antiguedad != null ? `${p.antiguedad} años` : null },
  ].filter((c) => c.value !== 0 && c.value != null);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: p.titulo,
    description: p.descripcion || `${p.titulo} en ${p.ubicacion}`,
    image: p.fotos.length ? p.fotos : undefined,
    offers: p.precioNum ? { "@type": "Offer", price: p.precioNum, priceCurrency: p.moneda } : undefined,
    address: { "@type": "PostalAddress", addressLocality: p.ubicacion, addressRegion: "Mendoza", addressCountry: "AR" },
  };

  return (
    <div className="bg-app-bg">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <nav aria-label="Migas de pan" className="text-[12px] text-text-muted mb-5 flex items-center gap-1.5 flex-wrap">
          <Link href="/" className="hover:text-gold transition-colors">Inicio</Link>
          <ChevronRight size={12} />
          <Link href="/catalogo" className="hover:text-gold transition-colors">Catálogo</Link>
          <ChevronRight size={12} />
          <span className="text-text-primary font-semibold font-mono">{p.codigo}</span>
        </nav>

        <Galeria p={p} />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10">
          <div className="space-y-6 min-w-0">
            {/* Encabezado */}
            <div>
              <p className="text-gold text-[11px] font-bold tracking-[0.28em] uppercase mb-3 flex items-center gap-3">
                <span className="h-px w-8 bg-gold/50" />{p.tipo}
              </p>
              <h1 className="font-display text-[28px] sm:text-[36px] md:text-[48px] font-medium text-forest leading-[1.1] text-balance">{p.titulo}</h1>
              <p className="mt-3 flex items-center gap-1.5 text-[15px] text-text-muted"><MapPin size={15} className="shrink-0" />{p.ubicacion}</p>
              <div className="mt-6 flex flex-wrap items-baseline gap-x-5 gap-y-1">
                <p className="font-display text-[44px] font-semibold text-gold leading-none">{p.precio}</p>
                {p.expensas && <p className="text-[14px] text-text-muted">+ Expensas {p.expensas}</p>}
              </div>
              {/* CTA rápida en móvil (la barra lateral queda al final) */}
              <div className="lg:hidden mt-6 grid grid-cols-2 gap-3">
                <a href={waConsulta} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-3.5 bg-whatsapp text-forest font-bold rounded-[12px]">
                  <MessageCircle size={17} />WhatsApp
                </a>
                <a href={`tel:+${BRAND.whatsapp}`} className="flex items-center justify-center gap-2 py-3.5 border border-border-mid bg-white text-text-primary font-semibold rounded-[12px]">
                  <Phone size={16} />Llamar
                </a>
              </div>
            </div>

            {/* Características */}
            <section className="bg-white rounded-[24px] border border-border-light p-7">
              <h2 className="font-display text-[26px] font-medium text-forest mb-5">Características</h2>
              <dl className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {caracteristicas.map((c) => (
                  <div key={c.label} className="flex items-center gap-3.5 p-4 bg-app-bg-tint border border-border-light rounded-[14px]">
                    <span className="grid place-items-center w-10 h-10 rounded-full bg-gold-bg text-gold shrink-0"><c.icon size={18} strokeWidth={1.7} /></span>
                    <div>
                      <dt className="text-[11px] text-text-muted">{c.label}</dt>
                      <dd className="text-[16px] font-bold text-text-primary">{c.value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </section>

            {p.descripcion && (
            <section className="bg-white rounded-[24px] border border-border-light p-7">
              <h2 className="font-display text-[26px] font-medium text-forest mb-4">Descripción</h2>
              <p className="text-[15px] text-text-secondary leading-[1.75]">{p.descripcion}</p>
            </section>
            )}

            {/* Amenities */}
            {p.amenities.length > 0 && (
              <section className="bg-white rounded-[24px] border border-border-light p-7">
                <h2 className="font-display text-[26px] font-medium text-forest mb-4">Amenities y extras</h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  {p.amenities.map((a) => (
                    <li key={a} className="flex items-center gap-3 text-[14px] text-text-secondary">
                      <span className="grid place-items-center w-6 h-6 rounded-full bg-gold-bg text-gold shrink-0"><Check size={13} strokeWidth={3} /></span>
                      {a}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Mapa */}
            <section className="bg-white rounded-[24px] border border-border-light p-7">
              <h2 className="font-display text-[26px] font-medium text-forest mb-4">Ubicación</h2>
              <div className="overflow-hidden rounded-[16px] border border-border-light">
                <iframe
                  title={`Mapa: ${p.ubicacion}`}
                  src={mapaEmbedUrl(`${p.ubicacion.replace(" · ", ", ")}, Mendoza, Argentina`)}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="w-full h-[320px] block"
                />
              </div>
              <p className="mt-3 text-[12px] text-text-muted">Ubicación aproximada de la zona. La dirección exacta se informa al coordinar la visita.</p>
            </section>
          </div>

          {/* Barra lateral */}
          <aside>
            <div className="bg-white rounded-[24px] border border-border-light p-7 shadow-card lg:sticky lg:top-[88px]">
              <p className="text-[12px] text-text-muted">{p.operacion === "venta" ? "Precio de venta" : "Alquiler mensual"}</p>
              <p className="font-display text-[34px] font-semibold text-gold leading-tight">{p.precio}</p>
              <p className="text-[12px] text-text-muted mt-1">Código <span className="font-mono font-bold text-text-primary">{p.codigo}</span></p>

              <div className="mt-6 space-y-3">
                <a href={waConsulta} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3.5 bg-whatsapp text-forest font-bold rounded-[12px] hover:brightness-95 transition">
                  <MessageCircle size={18} />Consultar por WhatsApp
                </a>
                <a href={waVisita} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3.5 bg-forest text-gold-light font-bold text-[14px] rounded-[12px] hover:bg-forest-3 transition-colors">
                  <CalendarCheck size={17} />Agendar visita
                </a>
                <a href={`tel:+${BRAND.whatsapp}`}
                  className="flex items-center justify-center gap-2 w-full py-3.5 border border-border-mid text-text-primary font-semibold text-[14px] rounded-[12px] hover:bg-app-bg transition-colors">
                  <Phone size={16} />Llamar
                </a>
                <div className="space-y-3">
                  <FavButton code={p.codigo} className="w-full" />
                  <ShareButton titulo={p.titulo} className="w-full" />
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-border-light">
                <p className="text-[12px] text-text-muted mb-3">Atendido por</p>
                <div className="flex items-center gap-3.5">
                  <span className="grid place-items-center w-12 h-12 rounded-full bg-forest text-gold-light font-display font-semibold text-[16px]">{BRAND.titular.iniciales}</span>
                  <div>
                    <p className="text-[14px] font-bold text-text-primary">{BRAND.titular.nombre}</p>
                    <p className="text-[12px] text-text-muted">{BRAND.titular.rol} · {BRAND.matricula}</p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Similares */}
        <section className="mt-20">
          <p className="text-gold text-[11px] font-bold tracking-[0.28em] uppercase mb-3 flex items-center gap-3">
            <span className="h-px w-8 bg-gold/50" />Seguí explorando
          </p>
          <h2 className="font-display text-[32px] md:text-[40px] font-medium text-forest leading-tight mb-8">Propiedades similares</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {similares(p, todas).map((s, i) => <PropertyCard key={s.codigo} p={s} index={i} />)}
          </div>
        </section>
      </div>
    </div>
  );
}
