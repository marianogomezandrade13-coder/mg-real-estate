import Link from "next/link";
import { MgLogo } from "@/components/sitio/MgLogo";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-forest grid place-items-center px-6 text-center">
      <div>
        <Link href="/" className="inline-block mb-12" aria-label="MG Real Estate — inicio"><MgLogo tone="light" className="h-24" /></Link>
        <p className="font-display text-[110px] md:text-[150px] leading-none font-medium text-gold-gradient">404</p>
        <h1 className="font-display text-white text-[28px] md:text-[36px] font-medium mt-4">Esta página no está a tu altura… todavía.</h1>
        <p className="text-white/60 mt-3 max-w-md mx-auto">
          La propiedad o la página que buscás no existe o fue dada de baja. Podés volver al catálogo y seguir explorando.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href="/catalogo" className="px-7 py-3.5 rounded-[12px] bg-gold-light text-forest font-bold text-[14px] hover:bg-champagne transition-colors">Ver catálogo</Link>
          <Link href="/" className="px-7 py-3.5 rounded-[12px] border border-white/25 text-white font-semibold text-[14px] hover:border-gold-light hover:text-gold-light transition-colors">Ir al inicio</Link>
        </div>
      </div>
    </main>
  );
}
