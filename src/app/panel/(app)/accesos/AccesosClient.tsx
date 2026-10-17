"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Search, KeyRound, ShieldOff, ShieldCheck, Copy, Check, MessageCircle, X, Loader2, UserPlus, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { BRAND, waLink } from "@/lib/brand";
import {
  crearClienteConAcceso, darAcceso, resetearClave, cambiarEstadoAcceso,
  type AccesoState, type Credenciales,
} from "./actions";

export type ClienteAcceso = {
  id: string; nombre: string; apellido: string; tipo: "propietario" | "inquilino";
  email: string | null; telefono: string | null; estado: "activo" | "suspendido" | "sin_acceso";
};

type Modal = { kind: "nuevo" } | { kind: "dar"; c: ClienteAcceso } | { kind: "reset"; c: ClienteAcceso } | null;

const ESTADO = {
  activo: { label: "Activo", cls: "bg-[#EAF7F0] text-[#1F9D5B]" },
  suspendido: { label: "Suspendido", cls: "bg-[#FBECEF] text-[#C0506A]" },
  sin_acceso: { label: "Sin acceso", cls: "bg-[#F6F3EC] text-[#676B63]" },
} as const;

const input = "w-full h-11 border border-[#E9E4D8] rounded-[9px] px-3 text-[16px] sm:text-[14px] outline-none focus:border-[#8A6529] focus:ring-4 focus:ring-[#8A6529]/15 bg-white";
const label = "block text-[12px] font-semibold text-[#565B56] mb-1";

function mensajeBienvenida(c: Credenciales, loginUrl: string) {
  return (
    `Hola ${c.nombre.split(" ")[0]}, te damos la bienvenida al portal de ${BRAND.name}.\n\n` +
    `Ingresá desde: ${loginUrl}\nUsuario: ${c.email}\nContraseña temporal: ${c.password}\n\n` +
    `Por tu seguridad, el sistema te pedirá cambiar la contraseña en tu primer ingreso.`
  );
}

function telefonoWa(t: string | null) {
  const d = (t ?? "").replace(/\D/g, "");
  if (d.length < 8) return null;
  return d.startsWith("54") ? d : `549${d.replace(/^0+/, "").replace(/^15/, "")}`;
}

/* ------------------------------ Credenciales ------------------------------ */
function Credenciales({ c, loginUrl, onClose }: { c: Credenciales; loginUrl: string; onClose: () => void }) {
  const [copiado, setCopiado] = useState<string | null>(null);
  const copiar = async (k: string, v: string) => {
    try { await navigator.clipboard.writeText(v); setCopiado(k); setTimeout(() => setCopiado(null), 1800); }
    catch { toast.error("No se pudo copiar. Seleccioná el texto manualmente."); }
  };
  const msg = mensajeBienvenida(c, loginUrl);
  const tel = telefonoWa(c.telefono);
  const fila = (k: string, etiqueta: string, valor: string, mono = false) => (
    <div className="flex items-center gap-2 bg-[#F6F3EC] rounded-[10px] px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide text-[#676B63]">{etiqueta}</p>
        <p className={cn("text-[15px] font-semibold text-[#1F2421] break-all", mono && "font-mono")}>{valor}</p>
      </div>
      <button onClick={() => copiar(k, valor)} aria-label={`Copiar ${etiqueta}`}
        className="grid place-items-center w-9 h-9 rounded-[8px] text-[#8A6529] hover:bg-white shrink-0">
        {copiado === k ? <Check size={16} /> : <Copy size={16} />}
      </button>
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 bg-[#FBF3E2] text-[#8A5A0F] rounded-[10px] px-3.5 py-3 text-[13px]">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <p><strong>Guardá o enviá esta contraseña ahora.</strong> Por seguridad no se vuelve a mostrar (si se pierde, generás una nueva).</p>
      </div>
      <p className="text-[13px] text-[#565B56]">Acceso creado para <strong>{c.nombre}</strong> ({c.tipo}).</p>
      {fila("email", "Usuario (email)", c.email)}
      {fila("pass", "Contraseña temporal", c.password, true)}
      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <a href={tel ? `https://wa.me/${tel}?text=${encodeURIComponent(msg)}` : waLink(msg)} target="_blank" rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 h-11 rounded-[10px] bg-[#25D366] text-[#16201B] text-[14px] font-bold">
          <MessageCircle size={16} />{tel ? "Enviar por WhatsApp" : "Abrir WhatsApp"}
        </a>
        <button onClick={() => copiar("msg", msg)}
          className="flex-1 flex items-center justify-center gap-2 h-11 rounded-[10px] border border-[#E9E4D8] text-[14px] font-semibold text-[#1F2421] hover:bg-[#F6F3EC]">
          {copiado === "msg" ? <Check size={16} /> : <Copy size={16} />}Copiar mensaje
        </button>
      </div>
      <button onClick={onClose} className="w-full h-11 rounded-[10px] bg-[#16201B] text-[#D9BC85] text-[14px] font-bold">Listo</button>
    </div>
  );
}

/* --------------------------------- Modal --------------------------------- */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-[#19161C]/50 backdrop-blur-[2px]" onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-white rounded-t-[22px] sm:rounded-[18px] shadow-modal max-h-[92dvh] overflow-y-auto p-5 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[17px] font-bold text-[#1F2421]">{title}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="grid place-items-center w-9 h-9 -mr-2 rounded-full text-[#676B63] hover:bg-[#F6F3EC]"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormAccion({
  action, submit, loginUrl, onClose, children,
}: {
  action: (s: AccesoState, fd: FormData) => Promise<AccesoState>;
  submit: string; loginUrl: string; onClose: () => void; children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  if (state?.ok && state.credenciales) return <Credenciales c={state.credenciales} loginUrl={loginUrl} onClose={onClose} />;
  return (
    <form action={formAction} className="space-y-4">
      {children}
      {state?.error && <p role="alert" className="text-[13px] text-[#C0506A] bg-[#FBECEF] rounded-[10px] px-3.5 py-2.5">{state.error}</p>}
      <button type="submit" disabled={pending}
        className="w-full h-11 rounded-[10px] bg-[#8A6529] hover:bg-[#6E4F1F] disabled:opacity-70 text-white text-[14px] font-bold flex items-center justify-center gap-2 transition-colors">
        {pending ? <><Loader2 size={16} className="animate-spin" />Procesando…</> : submit}
      </button>
    </form>
  );
}

/* --------------------------------- Vista --------------------------------- */
export function AccesosClient({ clientes, loginUrl, loadError }: { clientes: ClienteAcceso[]; loginUrl: string; loadError: string | null }) {
  const [modal, setModal] = useState<Modal>(null);
  const [filtro, setFiltro] = useState<"todos" | "propietario" | "inquilino">("todos");
  const [q, setQ] = useState("");
  const [, startTransition] = useTransition();
  const cerrar = () => setModal(null);

  const lista = useMemo(() => {
    const b = q.trim().toLowerCase();
    return clientes.filter((c) =>
      (filtro === "todos" || c.tipo === filtro) &&
      (!b || `${c.nombre} ${c.apellido} ${c.email ?? ""}`.toLowerCase().includes(b))
    );
  }, [clientes, filtro, q]);

  const conmutar = (c: ClienteAcceso) => {
    const activar = c.estado === "suspendido";
    if (!activar && !confirm(`¿Suspender el acceso de ${c.nombre} ${c.apellido}? No podrá ver su información hasta que lo reactives.`)) return;
    const fd = new FormData();
    fd.set("clienteId", c.id); fd.set("activar", activar ? "1" : "0");
    startTransition(async () => {
      const r = await cambiarEstadoAcceso(undefined, fd);
      if (r?.error) toast.error(r.error);
      else toast.success(r?.mensaje ?? "Listo");
    });
  };

  const acciones = (c: ClienteAcceso) => (
    <div className="flex flex-wrap gap-2">
      {c.estado === "sin_acceso" ? (
        <button onClick={() => setModal({ kind: "dar", c })} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] bg-[#8A6529] text-white text-[12px] font-semibold hover:bg-[#6E4F1F]">
          <KeyRound size={14} />Dar acceso
        </button>
      ) : (
        <>
          <button onClick={() => setModal({ kind: "reset", c })} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] border border-[#E9E4D8] text-[12px] font-semibold text-[#1F2421] hover:bg-[#F6F3EC]">
            <KeyRound size={14} />Nueva clave
          </button>
          <button onClick={() => conmutar(c)} className={cn("inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] border text-[12px] font-semibold",
            c.estado === "suspendido" ? "border-[#1F9D5B]/40 text-[#1F9D5B] hover:bg-[#EAF7F0]" : "border-[#C0506A]/30 text-[#C0506A] hover:bg-[#FBECEF]")}>
            {c.estado === "suspendido" ? <><ShieldCheck size={14} />Reactivar</> : <><ShieldOff size={14} />Suspender</>}
          </button>
        </>
      )}
    </div>
  );

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center mb-5">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A3A69C]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o email…" aria-label="Buscar cliente"
            className={cn(input, "pl-9")} />
        </div>
        <div role="group" aria-label="Filtrar por tipo" className="flex gap-1.5">
          {([["todos", "Todos"], ["propietario", "Propietarios"], ["inquilino", "Inquilinos"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setFiltro(v)} aria-pressed={filtro === v}
              className={cn("h-10 px-3.5 rounded-full text-[12px] font-semibold border transition-colors",
                filtro === v ? "bg-[#16201B] text-[#D9BC85] border-[#16201B]" : "bg-white border-[#E9E4D8] text-[#565B56] hover:border-[#8A6529]")}>{l}</button>
          ))}
        </div>
        <button onClick={() => setModal({ kind: "nuevo" })}
          className="sm:ml-auto inline-flex items-center justify-center gap-2 h-11 px-4 rounded-[10px] bg-[#8A6529] text-white text-[13px] font-semibold hover:bg-[#6E4F1F]">
          <UserPlus size={16} />Nuevo cliente con acceso
        </button>
      </div>

      {loadError && (
        <div role="alert" className="bg-white rounded-[16px] shadow-card p-8 text-center mb-5">
          <p className="text-[15px] font-semibold text-[#1F2421]">No pudimos cargar los clientes</p>
          <p className="text-[13px] text-[#676B63] mt-1 max-w-md mx-auto">{loadError}. Revisá la conexión con la base de datos (variables de Supabase).</p>
        </div>
      )}

      {!loadError && lista.length === 0 && (
        <div className="bg-white rounded-[16px] shadow-card p-10 text-center">
          <p className="text-[15px] font-semibold text-[#1F2421]">{clientes.length === 0 ? "Todavía no hay propietarios ni inquilinos" : "Sin resultados"}</p>
          <p className="text-[13px] text-[#676B63] mt-1">{clientes.length === 0 ? "Creá el primero con “Nuevo cliente con acceso”." : "Probá con otra búsqueda o filtro."}</p>
        </div>
      )}

      {/* Tarjetas (celular) */}
      <div className="space-y-3 md:hidden">
        {lista.map((c) => (
          <div key={c.id} className="bg-white rounded-[16px] shadow-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-[#1F2421] truncate">{c.apellido}, {c.nombre}</p>
                <p className="text-[12px] text-[#676B63] truncate">{c.email ?? "Sin email"}</p>
                <p className="text-[11px] text-[#8A6529] font-semibold capitalize mt-0.5">{c.tipo}</p>
              </div>
              <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0", ESTADO[c.estado].cls)}>{ESTADO[c.estado].label}</span>
            </div>
            <div className="mt-3">{acciones(c)}</div>
          </div>
        ))}
      </div>

      {/* Tabla (escritorio) */}
      {lista.length > 0 && (
        <div className="hidden md:block bg-white rounded-[16px] shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E9E4D8]">
                {["Cliente", "Tipo", "Email de acceso", "Estado", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#676B63] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id} className="border-b border-[#F6F3EC] hover:bg-[#FAF6EC]">
                  <td className="px-4 py-3 text-[13px] font-semibold text-[#1F2421]">{c.apellido}, {c.nombre}</td>
                  <td className="px-4 py-3 text-[12px] text-[#565B56] capitalize">{c.tipo}</td>
                  <td className="px-4 py-3 text-[12px] text-[#565B56]">{c.email ?? "—"}</td>
                  <td className="px-4 py-3"><span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full", ESTADO[c.estado].cls)}>{ESTADO[c.estado].label}</span></td>
                  <td className="px-4 py-3 flex justify-end">{acciones(c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal?.kind === "nuevo" && (
        <Sheet title="Nuevo cliente con acceso" onClose={cerrar}>
          <FormAccion action={crearClienteConAcceso} submit="Crear acceso" loginUrl={loginUrl} onClose={cerrar}>
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="n-nombre" className={label}>Nombre</label><input id="n-nombre" name="nombre" required autoComplete="off" className={input} /></div>
              <div><label htmlFor="n-apellido" className={label}>Apellido</label><input id="n-apellido" name="apellido" required autoComplete="off" className={input} /></div>
            </div>
            <div>
              <label htmlFor="n-tipo" className={label}>Tipo de cliente</label>
              <select id="n-tipo" name="tipo" required defaultValue="" className={input}>
                <option value="" disabled>Elegí una opción</option>
                <option value="propietario">Propietario</option>
                <option value="inquilino">Inquilino</option>
              </select>
            </div>
            <div><label htmlFor="n-email" className={label}>Email (será el usuario)</label><input id="n-email" name="email" type="email" inputMode="email" required autoCapitalize="none" className={input} /></div>
            <div><label htmlFor="n-tel" className={label}>WhatsApp (opcional, para enviarle los datos)</label><input id="n-tel" name="telefono" type="tel" inputMode="tel" placeholder="2634 123456" className={input} /></div>
            <p className="text-[12px] text-[#676B63]">Se genera una contraseña temporal segura. El cliente deberá cambiarla la primera vez que ingrese.</p>
          </FormAccion>
        </Sheet>
      )}

      {modal?.kind === "dar" && (
        <Sheet title={`Dar acceso a ${modal.c.nombre} ${modal.c.apellido}`} onClose={cerrar}>
          <FormAccion action={darAcceso} submit="Crear acceso" loginUrl={loginUrl} onClose={cerrar}>
            <input type="hidden" name="clienteId" value={modal.c.id} />
            <div><label htmlFor="d-email" className={label}>Email (será el usuario)</label>
              <input id="d-email" name="email" type="email" inputMode="email" defaultValue={modal.c.email ?? ""} required autoCapitalize="none" className={input} /></div>
            <p className="text-[12px] text-[#676B63]">Se genera una contraseña temporal segura que verás una sola vez.</p>
          </FormAccion>
        </Sheet>
      )}

      {modal?.kind === "reset" && (
        <Sheet title={`Nueva contraseña · ${modal.c.nombre} ${modal.c.apellido}`} onClose={cerrar}>
          <FormAccion action={resetearClave} submit="Generar nueva contraseña" loginUrl={loginUrl} onClose={cerrar}>
            <input type="hidden" name="clienteId" value={modal.c.id} />
            <p className="text-[13px] text-[#565B56]">Se reemplaza la contraseña actual por una temporal nueva y se le pedirá cambiarla al ingresar.</p>
          </FormAccion>
        </Sheet>
      )}
    </>
  );
}
