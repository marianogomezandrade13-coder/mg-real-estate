import Image from "next/image";
import { cn } from "@/lib/utils";

type Tone = "light" | "dark";

type Props = {
  /** "light": para fondos oscuros · "dark": para fondos claros */
  tone?: Tone;
  /** Solo el monograma "MG", sin "REAL ESTATE" (espacios chicos) */
  compact?: boolean;
  /** Se puede pasar la altura, p. ej. "h-24" */
  className?: string;
};

/** Logo oficial MG Real Estate (PNG transparente en /public/brand). */
export function MgLogo({ tone = "light", compact = false, className }: Props) {
  const oscuro = tone === "dark" ? "-oscuro" : "";
  return compact ? (
    <Image src={`/brand/mg-monograma${oscuro}.png`} alt="MG Real Estate" width={600} height={424} priority
      className={cn("h-10 w-auto select-none", className)} />
  ) : (
    <Image src={`/brand/mg-logo-completo${oscuro}.png`} alt="MG Real Estate" width={900} height={544} priority
      className={cn("h-14 w-auto select-none", className)} />
  );
}
