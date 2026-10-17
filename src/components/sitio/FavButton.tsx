"use client";

import { Heart } from "lucide-react";
import { useFavoritos } from "./useFavoritos";
import { cn } from "@/lib/utils";

export function FavButton({ code, className }: { code: string; className?: string }) {
  const { isFav, toggle } = useFavoritos();
  const fav = isFav(code);
  return (
    <button
      onClick={() => toggle(code)}
      aria-pressed={fav}
      className={cn(
        "inline-flex items-center justify-center gap-2 py-3.5 rounded-[12px] border text-[14px] font-semibold transition-colors",
        fav ? "border-danger/40 bg-danger-bg text-danger" : "border-border-mid text-text-primary hover:bg-app-bg",
        className
      )}
    >
      <Heart size={16} className={cn(fav && "fill-danger")} />
      {fav ? "Guardada en favoritos" : "Guardar en favoritos"}
    </button>
  );
}
