import Image from "next/image";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { MgLogo } from "@/components/sitio/MgLogo";
import { LoginForm } from "@/components/auth/LoginForm";
import { loginCliente } from "@/lib/auth-actions";
import { BRAND, waLink } from "@/lib/brand";

/** Único acceso del sistema: clientes van a su portal y el equipo al panel, según quién ingresa. */
export default function PortalLoginPage() {
  return (
    <div className="min-h-dvh flex">
      {/* Lado izquierdo — imagen (solo pantallas grandes) */}
      <div className="hidden lg:flex w-1/2 relative flex-col justify-between p-10 bg-forest">
        <div className="absolute inset-0">
          <Image src="/hero-loteo.jpeg" alt="" fill sizes="50vw" className="object-cover opacity-30" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-forest via-forest/40 to-forest/70" />
        </div>
        <div aria-hidden />
        <div className="relative z-10 text-center flex flex-col items-center">
          <Link href="/" className="inline-block mb-8" aria-label="Volver al sitio"><MgLogo tone="light" className="h-36" /></Link>
          <p className="text-gold-light text-[11px] font-bold tracking-[0.28em] uppercase mb-4">Portal de clientes</p>
          <h1 className="font-display text-white text-[44px] font-medium leading-[1.1] mb-4">Toda tu operación<br />en un solo lugar.</h1>
          <p className="text-white/70 text-[15px] leading-relaxed max-w-sm mx-auto">
            Accedé a tus propiedades, contratos, recibos y estado de cuenta las 24 horas.
          </p>
        </div>
        <p className="relative z-10 text-center text-[#A3A69C] text-[12px]">{BRAND.name} · {BRAND.matricula} · {BRAND.city}</p>
      </div>

      {/* Lado derecho — ingreso */}
      <div className="flex-1 flex flex-col bg-app-bg">
        <div className="lg:hidden bg-forest px-6 py-4">
          <Link href="/" aria-label="Volver al sitio" className="inline-block"><MgLogo tone="light" className="h-16" /></Link>
        </div>
        <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-16 py-10">
          <div className="max-w-sm w-full mx-auto">
            <h2 className="font-display text-[34px] font-medium text-forest leading-tight mb-1">Iniciar sesión</h2>
            <p className="text-[14px] text-text-muted mb-8">Ingresá con el usuario y la contraseña que te entregó {BRAND.name}.</p>

            <LoginForm action={loginCliente} />

            <div className="mt-8 pt-6 border-t border-border-mid text-[13px] text-text-muted">
              <p className="mb-3">¿Todavía no tenés acceso u olvidaste tu contraseña? Escribinos y te lo resolvemos.</p>
              <a href={waLink("Hola, necesito ayuda con mi acceso al portal de clientes.")} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-semibold text-gold hover:text-gold-dark transition-colors">
                <MessageCircle size={16} />Contactar por WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
