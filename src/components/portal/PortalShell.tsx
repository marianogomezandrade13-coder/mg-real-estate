"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MgLogo } from "@/components/sitio/MgLogo";
import { cn } from "@/lib/utils";
import { descargar } from "@/lib/portal-actions";

export type Tab = { id: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }> };

/**
 * Marco del portal: encabezado + pestañas arriba en pantallas grandes y barra inferior tipo app en celular.
 * `logoutSlot` es un <form action={salirCliente}> renderizado en el servidor.
 */
export function PortalShell({
  tabs, tab, onTab, user, logoutSlot, children,
}: {
  tabs: Tab[]; tab: string; onTab: (id: string) => void;
  user: { nombre: string; rol: string };
  logoutSlot: React.ReactNode;
  children: React.ReactNode;
}) {
  const iniciales = user.nombre.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
  return (
    <div className="min-h-dvh bg-[#F6F3EC] pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
      <header className="bg-[#16201B] h-[60px] flex items-center px-4 sm:px-6 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto w-full flex items-center gap-3">
          <Link href="/" aria-label="Volver al sitio"><MgLogo tone="light" compact /></Link>

          <nav className="hidden md:flex items-center gap-1 ml-3" aria-label="Secciones">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => onTab(t.id)} aria-current={tab === t.id ? "page" : undefined}
                className={cn("px-4 py-2 rounded-[9px] text-[13px] font-semibold transition-colors",
                  tab === t.id ? "bg-[#8A6529] text-white" : "text-[#CFCBBE] hover:text-white")}>
                {t.label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3 min-w-0">
            <div className="text-right min-w-0 hidden sm:block">
              <p className="text-[13px] font-semibold text-white truncate max-w-[180px]">{user.nombre}</p>
              <p className="text-[11px] text-[#A3A69C] capitalize">{user.rol}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-[#8A6529] flex items-center justify-center text-white font-bold text-[13px] shrink-0" aria-hidden>{iniciales}</div>
            {logoutSlot}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</div>

      {/* Barra inferior (celular) */}
      <nav aria-label="Secciones" className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#16201B] border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((t) => {
            const on = tab === t.id;
            return (
              <button key={t.id} onClick={() => { onTab(t.id); window.scrollTo({ top: 0 }); }} aria-current={on ? "page" : undefined}
                className={cn("flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] text-[10.5px] font-semibold transition-colors",
                  on ? "text-[#D9BC85]" : "text-[#8E9389]")}>
                <t.icon size={20} />
                <span className="leading-none">{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/** Botón que pide un enlace temporal al servidor y abre la descarga. */
export function BotonDescarga({
  tipo, id, disponible = true, className, children = "Descargar",
}: {
  tipo: "documento" | "liquidacion" | "recibo" | "contrato"; id: string; disponible?: boolean; className?: string; children?: React.ReactNode;
}) {
  const [pending, start] = useTransition();
  if (!disponible) return <span className={cn("inline-flex items-center gap-1.5 text-[12px] text-[#A3A69C]", className)}>PDF no disponible</span>;
  return (
    <button disabled={pending}
      onClick={() => start(async () => {
        const r = await descargar(tipo, id);
        if (r.url) window.location.assign(r.url); else toast.error(r.error ?? "No se pudo descargar.");
      })}
      className={cn("inline-flex items-center justify-center gap-1.5 text-[12px] font-semibold text-[#8A6529] hover:underline disabled:opacity-60 min-h-[36px]", className)}>
      {pending ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}{children}
    </button>
  );
}
