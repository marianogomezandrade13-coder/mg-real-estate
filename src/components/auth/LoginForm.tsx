"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import type { FormState } from "@/lib/auth-actions";
import { cn } from "@/lib/utils";

const field =
  "w-full h-12 bg-white border border-border-mid rounded-[11px] px-4 text-[16px] text-text-primary outline-none " +
  "focus:border-gold focus:ring-4 focus:ring-gold/15 transition-all placeholder:text-text-dim";

/** Formulario de ingreso compartido por el portal de clientes y el panel del equipo. */
export function LoginForm({
  action, submitLabel = "Ingresar", className,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel?: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");

  return (
    <form action={formAction} className={cn("space-y-5", className)} noValidate>
      <div>
        <label htmlFor="email" className="block text-[12px] font-semibold tracking-wide text-text-secondary mb-1.5">Correo electrónico</label>
        <input id="email" name="email" type="email" inputMode="email" autoComplete="username" autoCapitalize="none"
          spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@email.com" className={field} aria-invalid={!!state?.error} />
      </div>

      <div>
        <label htmlFor="password" className="block text-[12px] font-semibold tracking-wide text-text-secondary mb-1.5">Contraseña</label>
        <div className="relative">
          <input id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password"
            required placeholder="••••••••" className={cn(field, "pr-12")} aria-invalid={!!state?.error} />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-1 top-1/2 -translate-y-1/2 grid place-items-center w-10 h-10 text-text-muted hover:text-text-primary">
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      {state?.error && (
        <p role="alert" className="flex items-start gap-2 text-[13px] text-danger bg-danger-bg rounded-[10px] px-3.5 py-3">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />{state.error}
        </p>
      )}

      <button type="submit" disabled={pending}
        className="w-full h-12 bg-forest hover:bg-forest-3 disabled:opacity-70 text-gold-light font-bold text-[15px] rounded-[12px] transition-colors flex items-center justify-center gap-2">
        {pending ? <><Loader2 size={17} className="animate-spin" />Ingresando…</> : submitLabel}
      </button>
    </form>
  );
}
