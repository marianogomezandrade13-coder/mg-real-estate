"use client";

import { useActionState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { cambiarClave } from "@/lib/auth-actions";
import { MIN_CLAVE } from "@/lib/auth-constants";

const field =
  "w-full h-12 bg-white border border-border-mid rounded-[11px] px-4 text-[16px] text-text-primary outline-none " +
  "focus:border-gold focus:ring-4 focus:ring-gold/15 transition-all";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(cambiarClave, undefined);
  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="nueva" className="block text-[12px] font-semibold tracking-wide text-text-secondary mb-1.5">Nueva contraseña</label>
        <input id="nueva" name="nueva" type="password" autoComplete="new-password" required minLength={MIN_CLAVE} className={field} />
        <p className="text-[12px] text-text-muted mt-1.5">Mínimo {MIN_CLAVE} caracteres, con letras y números.</p>
      </div>
      <div>
        <label htmlFor="repetir" className="block text-[12px] font-semibold tracking-wide text-text-secondary mb-1.5">Repetí la contraseña</label>
        <input id="repetir" name="repetir" type="password" autoComplete="new-password" required className={field} />
      </div>
      {state?.error && (
        <p role="alert" className="flex items-start gap-2 text-[13px] text-danger bg-danger-bg rounded-[10px] px-3.5 py-3">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />{state.error}
        </p>
      )}
      <button type="submit" disabled={pending}
        className="w-full h-12 bg-forest hover:bg-forest-3 disabled:opacity-70 text-gold-light font-bold text-[15px] rounded-[12px] transition-colors flex items-center justify-center gap-2">
        {pending ? <><Loader2 size={17} className="animate-spin" />Guardando…</> : "Guardar contraseña"}
      </button>
    </form>
  );
}
