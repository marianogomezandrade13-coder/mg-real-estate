"use client";

import { registrarInteresPropiedad } from "@/lib/consultas";

/** Enlace de WhatsApp de una ficha que, además de abrir el chat, anota el interés en el CRM. */
export function LinkConsulta({ codigo, via, href, className, children }: {
  codigo: string; via: "consulta" | "visita"; href: string; className?: string; children: React.ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}
      onClick={() => { void registrarInteresPropiedad(codigo, via).catch(() => {}); }}>
      {children}
    </a>
  );
}
