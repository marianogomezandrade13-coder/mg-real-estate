"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const inputCls =
  "w-full h-11 sm:h-10 border border-[#E9E4D8] rounded-[9px] px-3 text-[16px] sm:text-[13px] outline-none focus:border-[#8A6529] focus:ring-4 focus:ring-[#8A6529]/15 bg-white disabled:bg-[#F6F3EC] disabled:text-[#676B63]";
export const labelCls = "block text-[12px] font-semibold text-[#565B56] mb-1";
export const btnPrimario =
  "inline-flex items-center justify-center gap-2 bg-[#8A6529] text-white text-[13px] font-semibold px-4 py-2.5 rounded-[10px] hover:bg-[#6E4F1F] transition-colors disabled:opacity-60";
export const btnSecundario =
  "inline-flex items-center justify-center gap-2 border border-[#E9E4D8] text-[#1F2421] text-[13px] font-semibold px-4 py-2.5 rounded-[10px] hover:bg-[#F6F3EC] transition-colors disabled:opacity-60";

export function Field({ label, children, className, hint }: { label: string; children: React.ReactNode; className?: string; hint?: string }) {
  return (
    <div className={className}>
      <label className={labelCls}>{label}</label>
      {children}
      {hint && <p className="text-[11px] text-[#676B63] mt-1">{hint}</p>}
    </div>
  );
}

/** Ventana: hoja desde abajo en celular, centrada en pantallas grandes. El cuerpo hace scroll y el pie queda fijo. */
export function Modal({
  titulo, onClose, children, footer, ancho = "sm:max-w-lg",
}: { titulo: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; ancho?: string }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className={cn("relative bg-white rounded-t-[22px] sm:rounded-[18px] shadow-modal w-full max-h-[94dvh] flex flex-col", ancho)}>
        <div className="flex items-center justify-between px-5 sm:px-6 pt-5 pb-3 border-b border-[#F6F3EC]">
          <h2 className="text-[18px] font-bold text-[#1F2421]">{titulo}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="grid place-items-center w-9 h-9 -mr-2 rounded-full text-[#676B63] hover:bg-[#F6F3EC]"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-5 sm:px-6 py-4 space-y-4">{children}</div>
        {footer && <div className="flex gap-3 px-5 sm:px-6 py-4 border-t border-[#F6F3EC] pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}

export function Vacio({ icono, titulo, texto, accion }: { icono: React.ReactNode; titulo: string; texto?: string; accion?: React.ReactNode }) {
  return (
    <div className="text-center py-14 px-6">
      <span className="mx-auto grid place-items-center w-14 h-14 rounded-full bg-[#F6EEDD] text-[#8A6529]">{icono}</span>
      <p className="text-[15px] font-semibold mt-4 text-[#1F2421]">{titulo}</p>
      {texto && <p className="text-[13px] mt-1 text-[#676B63] max-w-md mx-auto">{texto}</p>}
      {accion && <div className="mt-5">{accion}</div>}
    </div>
  );
}

export function ErrorCarga({ mensaje, onReintentar }: { mensaje: string; onReintentar: () => void }) {
  return (
    <div role="alert" className="text-center py-14 px-6">
      <p className="text-[15px] font-semibold text-[#1F2421]">No pudimos cargar los datos</p>
      <p className="text-[13px] mt-1 text-[#676B63] max-w-md mx-auto">{mensaje}</p>
      <button onClick={onReintentar} className="mt-5 bg-[#16201B] text-[#D9BC85] text-[13px] font-semibold px-5 py-2.5 rounded-[10px] hover:bg-[#283932]">Reintentar</button>
    </div>
  );
}

export function Kpi({ label, value, sub, color = "text-[#1F2421]" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-[16px] shadow-card p-4 sm:p-5">
      <p className="text-[13px] text-[#565B56]">{label}</p>
      <p className={cn("text-[24px] sm:text-[28px] font-bold mt-2 font-[family-name:var(--font-space-grotesk)] break-words", color)}>{value}</p>
      {sub && <p className="text-[12px] text-[#676B63] mt-1">{sub}</p>}
    </div>
  );
}
