import Image from "next/image";
import { Home, Building2, Trees, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Propiedad, TipoPropiedad } from "@/lib/propiedades";

const ICONO: Record<TipoPropiedad, typeof Home> = {
  casa: Home, ph: Home, departamento: Building2, finca: Trees, lote: Trees, local: Store, oficina: Building2,
};

/** Foto real si existe; si no, un placeholder con la paleta MG y el ícono del tipo de propiedad. */
export function PropertyVisual({
  p, className, imgClassName, sizes, iconSize = 54, priority, children,
}: {
  p: Pick<Propiedad, "foto" | "tono" | "tipo" | "titulo">;
  className?: string;
  /** Clases extra de la foto (p. ej. object-position para variar el recorte) */
  imgClassName?: string;
  sizes: string;
  iconSize?: number;
  priority?: boolean;
  children?: React.ReactNode;
}) {
  const Icon = ICONO[p.tipo];
  return (
    <div className={cn("relative overflow-hidden bg-gradient-to-br", p.tono, className)}>
      {p.foto ? (
        <Image src={p.foto} alt={p.titulo} fill sizes={sizes} priority={priority}
          className={cn("object-cover transition-transform duration-[900ms] ease-out group-hover:scale-110", imgClassName)} />
      ) : (
        <div className="absolute inset-0 grid place-items-center transition-transform duration-[900ms] ease-out group-hover:scale-110">
          <Icon size={iconSize} strokeWidth={1} className="text-white/35" aria-hidden />
        </div>
      )}
      {children}
    </div>
  );
}
