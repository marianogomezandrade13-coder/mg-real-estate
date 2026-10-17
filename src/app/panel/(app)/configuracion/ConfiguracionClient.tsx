"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Check, Minus, Copy, X, Loader2, ShieldOff, ShieldCheck, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import { fechaAR } from "@/lib/panel-db";
import { crearUsuarioStaff, alternarActivoUsuario, guardarComisiones, type ConfigState, type CredencialesStaff } from "./actions";

export type UsuarioStaff = { id: string; nombre: string; email: string; rol: "titular" | "contable"; activo: boolean };
export type EntradaAuditoria = { id: string; accion: string; entidad: string; fecha: string; usuario: string };
type Comisiones = { admin_alquiler_pct: number; venta_pct: number; tasacion_pct: number };

const PERMISOS: { modulo: string; titular: boolean; contable: boolean }[] = [
  { modulo: "Propiedades y CRM", titular: true, contable: false },
  { modulo: "Tasaciones", titular: true, contable: false },
  { modulo: "Finanzas y caja", titular: true, contable: true },
  { modulo: "Liquidaciones", titular: true, contable: true },
  { modulo: "Recibos", titular: true, contable: true },
  { modulo: "Documentos", titular: true, contable: true },
  { modulo: "Accesos y configuración", titular: true, contable: false },
];

const ACCION_LABEL: Record<string, string> = {
  crear_usuario_staff: "Creó un usuario del equipo", suspender_usuario_staff: "Desactivó un usuario del equipo", reactivar_usuario_staff: "Reactivó un usuario del equipo",
  actualizar_comisiones: "Actualizó las comisiones", crear_acceso_cliente: "Creó un cliente con acceso", dar_acceso_cliente: "Dio acceso al portal a un cliente",
  resetear_clave_cliente: "Generó una contraseña nueva", suspender_acceso_cliente: "Suspendió el acceso de un cliente", reactivar_acceso_cliente: "Reactivó el acceso de un cliente",
};

const iniciales = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
const input = "w-full h-10 border border-[#E9E4D8] rounded-[9px] px-3 text-[16px] sm:text-[13px] outline-none focus:border-[#8A6529] focus:ring-4 focus:ring-[#8A6529]/15 bg-white";
const label = "block text-[12px] font-semibold text-[#565B56] mb-1";

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

function Credenciales({ c, onClose }: { c: CredencialesStaff; onClose: () => void }) {
  const [copiado, setCopiado] = useState<string | null>(null);
  const copiar = async (k: string, v: string) => {
    try { await navigator.clipboard.writeText(v); setCopiado(k); setTimeout(() => setCopiado(null), 1800); }
    catch { toast.error("No se pudo copiar. Seleccioná el texto manualmente."); }
  };
  const fila = (k: string, etiqueta: string, valor: string) => (
    <div className="flex items-center gap-2 bg-[#F6F3EC] rounded-[10px] px-3.5 py-2.5">
      <div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-wide text-[#676B63]">{etiqueta}</p><p className="text-[15px] font-semibold text-[#1F2421] break-all font-mono">{valor}</p></div>
      <button onClick={() => copiar(k, valor)} aria-label={`Copiar ${etiqueta}`} className="grid place-items-center w-9 h-9 rounded-[8px] text-[#8A6529] hover:bg-white shrink-0">
        {copiado === k ? <Check size={16} /> : <Copy size={16} />}
      </button>
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 bg-[#FBF3E2] text-[#8A5A0F] rounded-[10px] px-3.5 py-3 text-[13px]">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <p><strong>Guardá o enviá esta contraseña ahora.</strong> Por seguridad no se vuelve a mostrar.</p>
      </div>
      <p className="text-[13px] text-[#565B56]">Usuario creado para <strong>{c.nombre}</strong> ({c.rol}). Entra en <span className="font-mono">/portal</span>.</p>
      {fila("email", "Usuario (email)", c.email)}
      {fila("pass", "Contraseña temporal", c.password)}
      <p className="text-[12px] text-[#676B63]">Va a tener que cambiarla desde “Mi cuenta” en el panel.</p>
      <button onClick={onClose} className="w-full h-11 rounded-[10px] bg-[#16201B] text-[#D9BC85] text-[14px] font-bold">Listo</button>
    </div>
  );
}

function FormNuevoUsuario({ onClose, onCreado }: { onClose: () => void; onCreado: (c: CredencialesStaff) => void }) {
  const [state, formAction, pending] = useActionState<ConfigState, FormData>(crearUsuarioStaff, undefined);
  useEffect(() => { if (state?.ok && state.credenciales) onCreado(state.credenciales); }, [state, onCreado]);
  if (state?.ok && state.credenciales) return <Credenciales c={state.credenciales} onClose={onClose} />;
  return (
    <form action={formAction} className="space-y-4">
      <div><label htmlFor="u-nombre" className={label}>Nombre y apellido</label><input id="u-nombre" name="nombre" required autoComplete="off" className={input} /></div>
      <div><label htmlFor="u-email" className={label}>Email (será el usuario)</label><input id="u-email" name="email" type="email" inputMode="email" required autoCapitalize="none" className={input} /></div>
      <div>
        <label htmlFor="u-rol" className={label}>Rol</label>
        <select id="u-rol" name="rol" required defaultValue="" className={input}>
          <option value="" disabled>Elegí una opción</option>
          <option value="titular">Titular (acceso completo)</option>
          <option value="contable">Contable (finanzas, liquidaciones, recibos)</option>
        </select>
      </div>
      <p className="text-[12px] text-[#676B63]">Se genera una contraseña temporal segura que se muestra una sola vez.</p>
      {state?.error && <p role="alert" className="text-[13px] text-[#C0506A] bg-[#FBECEF] rounded-[10px] px-3.5 py-2.5">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-full h-11 rounded-[10px] bg-[#8A6529] hover:bg-[#6E4F1F] disabled:opacity-70 text-white text-[14px] font-bold flex items-center justify-center gap-2">
        {pending ? <><Loader2 size={16} className="animate-spin" />Creando…</> : "Crear usuario"}
      </button>
    </form>
  );
}

export function ConfiguracionClient({
  usuarios, miUsuarioId, comisiones, actividad, loadError,
}: { usuarios: UsuarioStaff[]; miUsuarioId: string; comisiones: Comisiones; actividad: EntradaAuditoria[]; loadError: string | null }) {
  const [modalNuevo, setModalNuevo] = useState(false);
  const [lista, setLista] = useState(usuarios);
  const [form, setForm] = useState({ admin: String(comisiones.admin_alquiler_pct), venta: String(comisiones.venta_pct), tasacion: String(comisiones.tasacion_pct) });
  const [guardando, startGuardar] = useTransition();
  const [, startAlternar] = useTransition();
  const [trabajando, setTrabajando] = useState<string | null>(null);

  const conmutar = (u: UsuarioStaff) => {
    const activar = !u.activo;
    if (!activar && !confirm(`¿Desactivar a ${u.nombre}? No va a poder entrar al panel hasta que lo reactives.`)) return;
    const fd = new FormData(); fd.set("usuarioId", u.id); fd.set("activar", activar ? "1" : "0");
    setTrabajando(u.id);
    startAlternar(async () => {
      const r = await alternarActivoUsuario(undefined, fd);
      setTrabajando(null);
      if (r?.error) toast.error(r.error);
      else { setLista((xs) => xs.map((x) => (x.id === u.id ? { ...x, activo: activar } : x))); toast.success(r?.mensaje ?? "Listo"); }
    });
  };

  const guardarComis = () => {
    const fd = new FormData(); fd.set("admin", form.admin); fd.set("venta", form.venta); fd.set("tasacion", form.tasacion);
    startGuardar(async () => {
      const r = await guardarComisiones(undefined, fd);
      if (r?.error) toast.error(r.error); else toast.success(r?.mensaje ?? "Guardado");
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Usuarios */}
        <div className="bg-white rounded-[16px] shadow-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[16px] font-bold text-[#1F2421]">Usuarios y roles</h2>
            <button onClick={() => setModalNuevo(true)} className="flex items-center gap-2 bg-[#8A6529] text-white text-[12px] font-semibold px-3 py-2 rounded-[9px] hover:bg-[#6E4F1F]">
              <Plus size={13} /> Nuevo usuario
            </button>
          </div>
          {loadError ? <p role="alert" className="text-[13px] text-[#C0506A]">{loadError}</p> : lista.length === 0 ? (
            <p className="text-[13px] text-[#676B63] text-center py-6">Todavía no hay usuarios cargados.</p>
          ) : (
            <div className="space-y-1">
              {lista.map((u) => (
                <div key={u.id} className="flex items-center gap-3 p-3 rounded-[12px] hover:bg-[#F6F3EC] transition-colors">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-[14px] flex-shrink-0" style={{ background: u.rol === "titular" ? "#8A6529" : "#1F9D5B" }}>
                    {iniciales(u.nombre)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[#1F2421] truncate">{u.nombre}{u.id === miUsuarioId && <span className="text-[11px] text-[#676B63] font-normal"> · vos</span>}</p>
                    <p className="text-[12px] text-[#676B63] truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full", u.rol === "titular" ? "bg-[#F6EEDD] text-[#8A6529]" : "bg-[#EAF0FB] text-[#3B82C4]")}>{u.rol === "titular" ? "Titular" : "Contable"}</span>
                    <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", u.activo ? "bg-[#EAF7F0] text-[#1F9D5B]" : "bg-[#FBECEF] text-[#C0506A]")}>{u.activo ? "Activo" : "Desactivado"}</span>
                    {u.id !== miUsuarioId && (
                      <button onClick={() => conmutar(u)} disabled={trabajando === u.id} title={u.activo ? "Desactivar" : "Reactivar"} aria-label={u.activo ? "Desactivar" : "Reactivar"}
                        className={cn("grid place-items-center w-8 h-8 rounded-[8px]", u.activo ? "text-[#C0506A] hover:bg-[#FBECEF]" : "text-[#1F9D5B] hover:bg-[#EAF7F0]")}>
                        {trabajando === u.id ? <Loader2 size={14} className="animate-spin" /> : u.activo ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Actividad reciente (real, de la tabla auditoria) */}
          <div className="bg-white rounded-[16px] shadow-card p-6">
            <div className="flex items-center gap-2 mb-4"><Clock size={15} className="text-[#8A6529]" /><h2 className="text-[16px] font-bold text-[#1F2421]">Actividad reciente</h2></div>
            {actividad.length === 0 ? <p className="text-[13px] text-[#676B63] text-center py-4">Todavía no hay movimientos registrados.</p> : (
              <div className="space-y-3">
                {actividad.map((a) => (
                  <div key={a.id} className="flex items-start justify-between gap-3 py-1.5 border-b border-[#F6F3EC] last:border-0">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[#1F2421]">{ACCION_LABEL[a.accion] ?? a.accion}</p>
                      <p className="text-[11px] text-[#676B63]">{a.usuario}</p>
                    </div>
                    <span className="text-[11px] text-[#A3A69C] shrink-0">{fechaAR(a.fecha)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comisiones */}
          <div className="bg-white rounded-[16px] shadow-card p-6 space-y-4">
            <h2 className="text-[16px] font-bold text-[#1F2421]">Comisiones</h2>
            <p className="text-[12px] text-[#676B63] -mt-2">Se usan para calcular Liquidaciones y sugerir el valor en Tasaciones.</p>
            {[
              { label: "Administración alquiler", key: "admin" as const },
              { label: "Venta", key: "venta" as const },
              { label: "Tasación", key: "tasacion" as const },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <p className="text-[13px] text-[#565B56]">{item.label}</p>
                <div className="flex items-center gap-1">
                  <input value={form[item.key]} onChange={(e) => setForm((f) => ({ ...f, [item.key]: e.target.value }))} type="number" min="0" max="100" step="0.5"
                    className="w-16 h-9 border border-[#E9E4D8] rounded-[8px] px-2 text-[14px] font-bold text-center outline-none focus:border-[#8A6529] font-[family-name:var(--font-space-grotesk)]" />
                  <span className="text-[14px] font-bold text-[#565B56]">%</span>
                </div>
              </div>
            ))}
            <button onClick={guardarComis} disabled={guardando} className="w-full py-2.5 bg-[#8A6529] text-white rounded-[10px] text-[13px] font-semibold hover:bg-[#6E4F1F] disabled:opacity-70 flex items-center justify-center gap-2">
              {guardando && <Loader2 size={14} className="animate-spin" />}Guardar cambios
            </button>
          </div>
        </div>
      </div>

      {/* Permisos */}
      <div className="bg-white rounded-[16px] shadow-card p-6">
        <h2 className="text-[16px] font-bold text-[#1F2421] mb-1">Permisos por rol</h2>
        <p className="text-[12px] text-[#676B63] mb-4">Ya aplicados en el sistema: el contable no puede crear ni modificar estos módulos aunque entre por la URL.</p>
        <div className="overflow-x-auto"><table className="w-full min-w-[640px]">
          <thead><tr className="border-b border-[#E9E4D8]">
            <th className="text-left py-3 text-[11px] font-semibold text-[#676B63] uppercase tracking-wider">Módulo</th>
            <th className="text-center py-3 text-[11px] font-semibold text-[#676B63] uppercase tracking-wider">Titular</th>
            <th className="text-center py-3 text-[11px] font-semibold text-[#676B63] uppercase tracking-wider">Contable</th>
          </tr></thead>
          <tbody>
            {PERMISOS.map((p) => (
              <tr key={p.modulo} className="border-b border-[#F6F3EC]">
                <td className="py-3 text-[13px] text-[#565B56]">{p.modulo}</td>
                <td className="py-3 text-center">{p.titular ? <Check size={15} className="mx-auto text-[#1F9D5B]" /> : <Minus size={15} className="mx-auto text-[#E9E4D8]" />}</td>
                <td className="py-3 text-center">{p.contable ? <Check size={15} className="mx-auto text-[#1F9D5B]" /> : <Minus size={15} className="mx-auto text-[#E9E4D8]" />}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      {/* Sucursales */}
      <div className="bg-white rounded-[16px] shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-bold text-[#1F2421]">Sucursales</h2>
          <button onClick={() => toast.info("Próximamente vas a poder cargar más sucursales.")} className="text-[13px] font-semibold text-[#8A6529] hover:underline">+ Agregar</button>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-[12px] hover:bg-[#F6F3EC]">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-[13px] bg-[#8A6529]">SM</div>
          <div className="flex-1"><p className="text-[14px] font-semibold text-[#1F2421]">San Martín (casa central)</p><p className="text-[12px] text-[#676B63]">{BRAND.address}</p></div>
          <span className="text-[11px] font-bold bg-[#F6EEDD] text-[#8A6529] px-2 py-0.5 rounded-full">Principal</span>
        </div>
      </div>

      {modalNuevo && (
        <Sheet title="Nuevo usuario del equipo" onClose={() => setModalNuevo(false)}>
          <FormNuevoUsuario onClose={() => setModalNuevo(false)}
            onCreado={(c) => setLista((xs) => (xs.some((x) => x.id === c.id) ? xs : [...xs, { id: c.id, nombre: c.nombre, email: c.email, rol: c.rol, activo: true }]))} />
        </Sheet>
      )}
    </div>
  );
}
