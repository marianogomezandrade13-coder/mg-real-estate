"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Heart } from "lucide-react";
import { MgLogo } from "./MgLogo";
import { useFavoritos } from "./useFavoritos";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Comprar", href: "/catalogo?op=venta" },
  { label: "Alquilar", href: "/catalogo?op=alquiler" },
  { label: "Emprendimientos", href: "/catalogo?tipo=emprendimiento" },
  { label: "Tasaciones", href: "/contacto#tasacion" },
  { label: "Contacto", href: "/contacto" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const { favs } = useFavoritos();
  const [scrolled, setScrolled] = useState(false);
  // El menú móvil guarda en qué ruta se abrió: al navegar deja de coincidir y se cierra solo.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const solid = scrolled || !isHome || open;

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-500",
        solid
          ? "bg-forest/92 backdrop-blur-xl border-b border-gold-light/15 h-[64px]"
          : "bg-transparent border-b border-transparent h-[76px]"
      )}
    >
      <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
        <Link href="/" aria-label="MG Real Estate — inicio">
          <MgLogo tone="light" className="h-12" />
        </Link>

        <nav className="hidden lg:flex items-center gap-8" aria-label="Principal">
          {NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="relative text-[14px] font-medium text-white/80 hover:text-white transition-colors after:absolute after:left-0 after:-bottom-1.5 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-gold-light after:transition-transform after:duration-300 hover:after:scale-x-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          <Link
            href="/favoritos"
            aria-label="Favoritos"
            className="relative text-white/80 hover:text-gold-light transition-colors p-2"
          >
            <Heart size={20} className={cn(favs.length > 0 && "fill-gold-light text-gold-light")} />
            {favs.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 grid place-items-center min-w-[16px] h-4 px-1 rounded-full bg-gold-light text-forest text-[10px] font-bold">
                {favs.length}
              </span>
            )}
          </Link>
          <Link
            href="/portal"
            className="text-[13px] font-semibold text-white/90 border border-white/25 px-4 py-2 rounded-[9px] hover:border-gold-light hover:text-gold-light transition-colors"
          >
            Ingresar
          </Link>
          <Link
            href="/contacto"
            className="text-[13px] font-semibold text-forest bg-gold-light px-4 py-2 rounded-[9px] hover:bg-champagne transition-colors"
          >
            Consultar
          </Link>
        </div>

        <button
          type="button"
          className="lg:hidden text-white p-2 -mr-2"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          onClick={() => setOpenedAt(open ? null : pathname)}
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Menú móvil */}
      <div
        className={cn(
          "lg:hidden absolute inset-x-0 top-full bg-forest border-b border-gold-light/15 overflow-hidden transition-[max-height,opacity] duration-500",
          open ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <nav className="px-6 py-4 flex flex-col" aria-label="Móvil" onClick={() => setOpenedAt(null)}>
          {NAV.map((item) => (
            <Link key={item.label} href={item.href} className="py-3 text-[16px] font-medium text-white/85 border-b border-white/[0.06]">
              {item.label}
            </Link>
          ))}
          <Link href="/favoritos" className="py-3 text-[16px] font-medium text-white/85 border-b border-white/[0.06] flex items-center gap-2">
            <Heart size={16} className={cn(favs.length > 0 && "fill-gold-light text-gold-light")} />
            Favoritos{favs.length > 0 && ` (${favs.length})`}
          </Link>
          <div className="flex gap-3 pt-4">
            <Link href="/portal" className="flex-1 text-center text-[14px] font-semibold text-white border border-white/25 py-2.5 rounded-[9px]">
              Ingresar
            </Link>
            <Link href="/contacto" className="flex-1 text-center text-[14px] font-semibold text-forest bg-gold-light py-2.5 rounded-[9px]">
              Consultar
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
