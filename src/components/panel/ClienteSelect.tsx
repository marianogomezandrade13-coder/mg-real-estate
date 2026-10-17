"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { sb, nombreCliente, type Cliente, type TipoCliente } from "@/lib/panel-db";
import { inputCls, labelCls } from "./ui";

/** Elegir un cliente existente o crear uno nuevo en el momento (sin acceso al portal; el acceso se da en "Accesos de clientes"). */
export function ClienteSelect({
  value, onChange, clientes, onCreado, tipos, tipoNuevo, placeholder = "Elegí un cliente",
}: {
  value: string; onChange: (id: string) => void;
  clientes: Cliente[]; onCreado: (c: Cliente) => void;
  /** Tipos de cliente que se listan */
  tipos: TipoCliente[];
  /** Tipo con el que se crea un cliente nuevo */
  tipoNuevo: TipoCliente;
  placeholder?: string;
}) {
  const [nuevo, setNuevo] = useState(false);
  const [f, setF] = useState({ nombre: "", apellido: "", telefono: "", email: "", dni: "" });
  const [saving, setSaving] = useState(false);

  const crear = async () => {
    if (!f.nombre.trim() || !f.apellido.trim()) { toast.error("Completá nombre y apellido"); return; }
    setSaving(true);
    const { data, error } = await sb.from("clientes").insert({
      nombre: f.nombre.trim(), apellido: f.apellido.trim(), tipo: tipoNuevo, telefono: f.telefono.trim() || null, whatsapp: f.telefono.trim() || null,
      email: f.email.trim().toLowerCase() || null, dni: f.dni.trim() || null, cuit: null, direccion: null, observaciones: null, sucursal_id: null, auth_id: null, acceso_activo: true,
    }).select("id,nombre,apellido,tipo,email,telefono,dni,cuit").single();
    setSaving(false);
    if (error || !data) { toast.error("No se pudo crear el cliente: " + (error?.message ?? "")); return; }
    onCreado(data); onChange(data.id);
    setNuevo(false); setF({ nombre: "", apellido: "", telefono: "", email: "", dni: "" });
    toast.success(`${nombreCliente(data)} agregado`);
  };

  const lista = clientes.filter((c) => tipos.includes(c.tipo));
  return (
    <div>
      <div className="flex gap-2">
        <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} aria-label={placeholder}>
          <option value="">{placeholder}</option>
          {lista.map((c) => <option key={c.id} value={c.id}>{nombreCliente(c)}</option>)}
        </select>
        <button type="button" onClick={() => setNuevo((v) => !v)} aria-expanded={nuevo}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 h-11 sm:h-10 rounded-[9px] border border-[#E9E4D8] text-[12px] font-semibold text-[#8A6529] hover:bg-[#F6EEDD]">
          <Plus size={14} />Nuevo
        </button>
      </div>
      {nuevo && (
        <div className="mt-2 p-3 rounded-[12px] bg-[#FAF6EC] border border-[#E9E4D8] space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <div><label className={labelCls}>Nombre *</label><input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} className={inputCls} /></div>
            <div><label className={labelCls}>Apellido *</label><input value={f.apellido} onChange={(e) => setF({ ...f, apellido: e.target.value })} className={inputCls} /></div>
            <div><label className={labelCls}>WhatsApp</label><input type="tel" inputMode="tel" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} className={inputCls} placeholder="2634 123456" /></div>
            <div><label className={labelCls}>Email</label><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={inputCls} /></div>
            <div className="col-span-2"><label className={labelCls}>DNI (opcional, para contratos)</label><input value={f.dni} onChange={(e) => setF({ ...f, dni: e.target.value })} className={inputCls} placeholder="20123456" /></div>
          </div>
          <button type="button" onClick={() => void crear()} disabled={saving}
            className="w-full h-10 rounded-[9px] bg-[#16201B] text-[#D9BC85] text-[13px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
            {saving && <Loader2 size={14} className="animate-spin" />}Guardar cliente
          </button>
        </div>
      )}
    </div>
  );
}
