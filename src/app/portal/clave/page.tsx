import { KeyRound } from "lucide-react";
import { MgLogo } from "@/components/sitio/MgLogo";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { requireCliente } from "@/lib/auth";

/** Primer ingreso con contraseña temporal: el cliente elige la suya antes de ver su información. */
export default async function CambiarClavePage() {
  const cliente = await requireCliente();
  return (
    <main className="min-h-dvh bg-forest grid place-items-center px-5 py-10">
      <div className="w-full max-w-[440px]">
        <div className="flex justify-center mb-8"><MgLogo tone="light" className="h-28" /></div>
        <div className="bg-white rounded-[24px] p-7 sm:p-8 shadow-modal">
          <span className="grid place-items-center w-11 h-11 rounded-full bg-gold-bg text-gold mb-4"><KeyRound size={20} /></span>
          <h1 className="font-display text-[28px] font-medium text-forest leading-tight">
            {cliente.debeCambiarClave ? "Elegí tu contraseña" : "Cambiar contraseña"}
          </h1>
          <p className="text-[13px] text-text-muted mt-2 mb-6">
            {cliente.debeCambiarClave
              ? `Hola ${cliente.nombre}. Por seguridad, reemplazá la contraseña temporal por una que solo vos conozcas.`
              : "Elegí una contraseña nueva para tu cuenta."}
          </p>
          <ChangePasswordForm />
        </div>
      </div>
    </main>
  );
}
