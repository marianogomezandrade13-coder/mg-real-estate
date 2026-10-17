"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Building2, Handshake, Calculator, CalendarDays, FileText, FileSignature, Receipt,
  Banknote, Wallet, Globe, FolderOpen, Settings, KeyRound, Search, ChevronDown, Menu, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RolProvider } from "@/lib/rol-context";
import { MgLogo } from "@/components/sitio/MgLogo";

type Rol = "titular" | "contable";

const NAV_SECTIONS: { label: string; items: { label: string; icon: typeof Users; href: string; badge?: number; solo?: Rol }[] }[] = [
  {
    label: "PRINCIPAL",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, href: "/panel/dashboard" },
      { label: "CRM · Embudo", icon: Users, href: "/panel/crm" },
      { label: "Propiedades", icon: Building2, href: "/panel/propiedades" },
      { label: "Captación", icon: Handshake, href: "/panel/captacion" },
    ],
  },
  {
    label: "OPERACIONES",
    items: [
      { label: "Tasaciones IA", icon: Calculator, href: "/panel/tasaciones" },
      { label: "Agenda", icon: CalendarDays, href: "/panel/agenda" },
      { label: "Alquileres", icon: FileText, href: "/panel/alquileres" },
      { label: "Contratos", icon: FileSignature, href: "/panel/contratos" },
      { label: "Liquidaciones", icon: Receipt, href: "/panel/liquidaciones" },
      { label: "Recibos", icon: Banknote, href: "/panel/recibos" },
    ],
  },
  {
    label: "ADMINISTRACIÓN",
    items: [
      { label: "Finanzas", icon: Banknote, href: "/panel/finanzas" },
      { label: "Caja diaria", icon: Wallet, href: "/panel/caja" },
      { label: "Portales & Redes", icon: Globe, href: "/panel/portales" },
      { label: "Documentos", icon: FolderOpen, href: "/panel/documentos" },
      { label: "Accesos de clientes", icon: KeyRound, href: "/panel/accesos", solo: "titular" },
      { label: "Configuración", icon: Settings, href: "/panel/configuracion", solo: "titular" },
    ],
  },
];

const iniciales = (nombre: string) =>
  nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "MG";

export function PanelLayout({
  children, user, logoutSlot,
}: {
  children: React.ReactNode;
  user: { nombre: string; rol: Rol };
  /** Botón/form de cerrar sesión (Server Action) renderizado desde el layout del servidor */
  logoutSlot?: React.ReactNode;
}) {
  const pathname = usePathname();
  // El cajón móvil guarda en qué ruta se abrió: al navegar deja de coincidir y se cierra solo.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;
  const close = () => setOpenedAt(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenedAt(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="flex h-dvh overflow-hidden bg-[#F6F3EC]">
      {/* Fondo oscuro del cajón (solo móvil/tablet) */}
      <div
        onClick={close}
        aria-hidden
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      />

      {/* Sidebar: cajón en móvil, fijo en escritorio */}
      <aside
        id="panel-sidebar"
        aria-label="Navegación del panel"
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] bg-[#16201B] flex flex-col overflow-y-auto",
          "transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)]",
          "lg:static lg:w-[250px] lg:max-w-none lg:translate-x-0 lg:flex-shrink-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="px-5 py-4 flex items-center gap-3 border-b border-white/[0.06]">
          <MgLogo tone="light" compact className="h-9" />
          <div className="flex-1">
            <p className="text-white text-[11px] font-bold tracking-widest uppercase leading-none">Panel</p>
            <p className="text-gold-light text-[11px] font-bold tracking-widest uppercase leading-none mt-1">Interno</p>
          </div>
          <button onClick={close} aria-label="Cerrar menú" className="lg:hidden p-2 -mr-2 text-white/70 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
          {NAV_SECTIONS.map(({ label, items }) => {
            const visibles = items.filter((i) => !i.solo || i.solo === user.rol);
            if (!visibles.length) return null;
            return (
              <div key={label}>
                <p className="text-[10px] font-semibold text-[#8E9389] tracking-widest px-3 mb-1.5">{label}</p>
                <div className="space-y-0.5">
                  {visibles.map(({ label: itemLabel, icon: Icon, href, badge }) => {
                    const active = pathname === href;
                    return (
                      <Link
                        key={href}
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 px-3 py-3 lg:py-2.5 rounded-[10px] text-sm font-medium transition-colors",
                          active ? "bg-[#8A6529] text-white" : "text-[#A3A69C] hover:bg-[#1F2C26] hover:text-white"
                        )}
                      >
                        <Icon size={16} className="flex-shrink-0" />
                        <span className="flex-1">{itemLabel}</span>
                        {badge && (
                          <span className="bg-[#8A6529]/30 text-[#D9BC85] text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-white/[0.06] flex items-center gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="w-9 h-9 rounded-full bg-[#8A6529] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {iniciales(user.nombre)}
          </div>
          <Link href="/panel/cuenta" title="Mi cuenta · cambiar contraseña" className="min-w-0 flex-1 rounded-[8px] hover:bg-white/5 -mx-1 px-1 transition-colors">
            <p className="text-white text-[13px] font-semibold truncate">{user.nombre}</p>
            <p className="text-[#8E9389] text-[11px] truncate capitalize">{user.rol} · Mi cuenta</p>
          </Link>
          {logoutSlot}
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-[58px] bg-white border-b border-[#E9E4D8] flex items-center px-3 sm:px-6 gap-2 sm:gap-4 flex-shrink-0">
          <button
            onClick={() => setOpenedAt(pathname)}
            aria-label="Abrir menú"
            aria-expanded={open}
            aria-controls="panel-sidebar"
            className="lg:hidden grid place-items-center w-10 h-10 -ml-1 rounded-[10px] text-[#1F2421] hover:bg-[#F6F3EC]"
          >
            <Menu size={22} />
          </button>
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A3A69C]" />
            <input
              type="search"
              placeholder="Buscar propiedad, cliente..."
              className="w-full h-10 sm:h-9 bg-[#F6F3EC] border border-[#E9E4D8] rounded-[9px] pl-8 pr-3 text-[16px] sm:text-sm text-[#1F2421] placeholder:text-[#A3A69C] outline-none focus:border-[#8A6529] transition-colors"
            />
          </div>
          <div className="ml-auto hidden sm:flex items-center gap-2">
            <button className="h-9 bg-[#F6F3EC] border border-[#E9E4D8] rounded-[9px] px-3 text-sm text-[#1F2421] flex items-center gap-1.5 hover:border-[#8A6529] transition-colors">
              San Martín
              <ChevronDown size={13} className="text-[#676B63]" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overscroll-contain"><RolProvider rol={user.rol}>{children}</RolProvider></main>
      </div>
    </div>
  );
}
