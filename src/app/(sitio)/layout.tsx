import Link from "next/link";
import { MessageCircle, MapPin, Phone, Mail } from "lucide-react";
import { MgLogo } from "@/components/sitio/MgLogo";
import { SiteHeader } from "@/components/sitio/SiteHeader";
import { BRAND, waLink } from "@/lib/brand";

export default function SitioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:bg-gold-light focus:text-forest focus:font-bold focus:px-4 focus:py-2 focus:rounded-[9px]">
        Saltar al contenido
      </a>
      <SiteHeader />

      {/* El hero de la home se monta detrás del header con margen negativo */}
      <main id="contenido" className="pt-[64px]">{children}</main>

      {/* Footer */}
      <footer className="bg-forest text-[#A3A69C] pt-16 pb-8 px-6">
        <div className="max-w-7xl mx-auto grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <MgLogo tone="light" className="h-28" />
            <p className="font-display text-[20px] text-white/90 mt-6 max-w-xs leading-snug">{BRAND.tagline}</p>
            <p className="text-[12px] mt-4">{BRAND.matricula} · {BRAND.titular.nombre}</p>
          </div>

          <div className="space-y-2.5 text-[14px]">
            <p className="text-gold-light text-[11px] font-bold tracking-[0.2em] uppercase mb-4">Propiedades</p>
            <Link href="/catalogo?op=venta" className="block hover:text-white transition-colors">Comprar</Link>
            <Link href="/catalogo?op=alquiler" className="block hover:text-white transition-colors">Alquilar</Link>
            <Link href="/catalogo?tipo=emprendimiento" className="block hover:text-white transition-colors">Emprendimientos</Link>
            <Link href="/propiedades/casas-en-venta" className="block hover:text-white transition-colors">Casas en venta</Link>
            <Link href="/propiedades/departamentos-en-alquiler" className="block hover:text-white transition-colors">Departamentos en alquiler</Link>
            <Link href="/propiedades/lotes-en-venta" className="block hover:text-white transition-colors">Lotes en venta</Link>
            <Link href="/favoritos" className="block hover:text-white transition-colors">Mis favoritos</Link>
          </div>

          <div className="space-y-2.5 text-[14px]">
            <p className="text-gold-light text-[11px] font-bold tracking-[0.2em] uppercase mb-4">Empresa</p>
            <Link href="/contacto#tasacion" className="block hover:text-white transition-colors">Tasaciones</Link>
            <Link href="/contacto" className="block hover:text-white transition-colors">Contacto</Link>
            <Link href="/portal" className="block hover:text-white transition-colors">Portal de clientes</Link>
          </div>

          <div className="space-y-3 text-[14px]">
            <p className="text-gold-light text-[11px] font-bold tracking-[0.2em] uppercase mb-4">Contacto</p>
            <p className="flex gap-2.5"><MapPin size={16} className="mt-0.5 shrink-0 text-gold-light" />{BRAND.address}</p>
            <p className="flex gap-2.5"><Phone size={16} className="mt-0.5 shrink-0 text-gold-light" />{BRAND.phoneDisplay}</p>
            <p className="flex gap-2.5 break-all"><Mail size={16} className="mt-0.5 shrink-0 text-gold-light" />{BRAND.email}</p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-14 pt-6 border-t border-white/10 text-[12px] flex flex-col sm:flex-row justify-between gap-2">
          <span>© {new Date().getFullYear()} {BRAND.name} · {BRAND.city}</span>
          <span>Todos los derechos reservados</span>
        </div>
      </footer>

      {/* WhatsApp flotante */}
      <a
        href={waLink(`Hola, me comunico desde el sitio web de ${BRAND.name}`)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Escribinos por WhatsApp"
        className="mg-anim fixed bottom-6 right-6 z-50 w-14 h-14 bg-whatsapp rounded-full grid place-items-center text-white shadow-elevated hover:scale-110 transition-transform"
        style={{ animation: "mg-pulse-ring 2.4s ease-out infinite" }}
      >
        <MessageCircle size={26} fill="currentColor" strokeWidth={1.5} />
      </a>
    </div>
  );
}
