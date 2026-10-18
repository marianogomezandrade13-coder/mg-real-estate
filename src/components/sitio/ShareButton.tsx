"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ShareButton({ titulo, className }: { titulo: string; className?: string }) {
  const compartir = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title: titulo, url }); return; }
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("No se pudo compartir. Copiá el link desde la barra del navegador.");
    }
  };
  return (
    <button type="button" onClick={() => void compartir()}
      className={cn("inline-flex items-center justify-center gap-2 py-3.5 rounded-[12px] border border-border-mid text-text-primary text-[14px] font-semibold hover:bg-app-bg transition-colors", className)}>
      <Share2 size={16} />Compartir
    </button>
  );
}
