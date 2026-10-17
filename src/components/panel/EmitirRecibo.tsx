"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Modal, Field, inputCls, btnPrimario, btnSecundario } from "./ui";
import { ClienteSelect } from "./ClienteSelect";
import { sb, hoyISO, type Cliente } from "@/lib/panel-db";
import { siguienteNumeroRecibo, archivarPdfRecibo, type ReciboRow } from "@/lib/panel-recibos";
import { dinero } from "@/lib/format";

export type ReciboInicial = { clienteId?: string; concepto?: string; monto?: number; moneda?: "ARS" | "USD"; iva?: boolean };

/** Ventana para emitir un recibo: lo guarda, genera su PDF con QR, lo archiva para el cliente y lo descarga. */
export function EmitirRecibo({
  clientes, onClienteCreado, inicial, onClose, onEmitido,
}: {
  clientes: Cliente[]; onClienteCreado: (c: Cliente) => void;
  inicial?: ReciboInicial; onClose: () => void; onEmitido: (r: ReciboRow) => void;
}) {
  const [f, setF] = useState({
    clienteId: inicial?.clienteId ?? "", concepto: inicial?.concepto ?? "", monto: inicial?.monto ? String(inicial.monto) : "",
    moneda: inicial?.moneda ?? ("ARS" as "ARS" | "USD"), iva: inicial?.iva ?? false, fecha: hoyISO(),
  });
  const [saving, setSaving] = useState(false);

  const monto = parseFloat(f.monto) || 0;
  const iva = f.iva ? Math.round(monto * 0.21) : 0;
  const total = monto + iva;

  const emitir = async () => {
    if (!f.clienteId) { toast.error("Elegí el cliente"); return; }
    if (!f.concepto.trim()) { toast.error("Escribí el concepto"); return; }
    if (!(monto > 0)) { toast.error("El monto debe ser mayor a 0"); return; }
    setSaving(true);
    try {
      let numero = await siguienteNumeroRecibo();
      const armar = (n: string) => ({
        numero: n, cliente_id: f.clienteId, concepto: f.concepto.trim(), honorarios: monto, iva, total, moneda: f.moneda, fecha: f.fecha,
        qr_payload: null, pdf_url: null, enviado_por: null, sucursal_id: null,
      });
      let res = await sb.from("recibos").insert(armar(numero)).select("*").single();
      if (res.error?.code === "23505") { numero = await siguienteNumeroRecibo(); res = await sb.from("recibos").insert(armar(numero)).select("*").single(); }
      if (res.error || !res.data) throw new Error(res.error?.message ?? "No se pudo guardar el recibo");

      let recibo = res.data;
      try {
        const { doc, path } = await archivarPdfRecibo(recibo, clientes.find((c) => c.id === f.clienteId));
        recibo = { ...recibo, pdf_url: path };
        doc.save(`Recibo-${numero.replace("#", "")}.pdf`);
        toast.success(`Recibo ${numero} emitido y disponible para el cliente`);
      } catch {
        toast.warning(`Recibo ${numero} guardado, pero no se pudo archivar el PDF. Volvé a generarlo desde la lista.`);
      }
      onEmitido(recibo);
      onClose();
    } catch (e) {
      toast.error("No se pudo emitir: " + (e as Error).message);
    } finally { setSaving(false); }
  };

  return (
    <Modal titulo="Emitir recibo" onClose={onClose} ancho="sm:max-w-md"
      footer={<>
        <button onClick={onClose} className={`${btnSecundario} flex-1`}>Cancelar</button>
        <button onClick={() => void emitir()} disabled={saving} className={`${btnPrimario} flex-1`}>
          {saving && <Loader2 size={14} className="animate-spin" />}{saving ? "Emitiendo…" : "Emitir y descargar PDF"}
        </button>
      </>}>
      <Field label="Cliente">
        <ClienteSelect value={f.clienteId} onChange={(id) => setF((x) => ({ ...x, clienteId: id }))} clientes={clientes} onCreado={onClienteCreado}
          tipos={["inquilino", "propietario", "otro"]} tipoNuevo="inquilino" />
      </Field>
      <Field label="Concepto"><input value={f.concepto} onChange={(e) => setF({ ...f, concepto: e.target.value })} className={inputCls} placeholder="Ej: Alquiler octubre 2026 · MG-0012" /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Monto" className="col-span-2"><input type="number" inputMode="decimal" min="0" value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} className={inputCls} /></Field>
        <Field label="Moneda"><select value={f.moneda} onChange={(e) => setF({ ...f, moneda: e.target.value as "ARS" | "USD" })} className={inputCls}><option>ARS</option><option>USD</option></select></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha"><input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} className={inputCls} /></Field>
        <label className="flex items-center gap-2.5 self-end h-11 sm:h-10 cursor-pointer select-none">
          <input type="checkbox" checked={f.iva} onChange={(e) => setF({ ...f, iva: e.target.checked })} className="w-4 h-4 accent-[#8A6529]" />
          <span className="text-[13px] text-[#1F2421]">Aplicar IVA 21%</span>
        </label>
      </div>
      {monto > 0 && (
        <div className="bg-[#F6F3EC] rounded-[10px] p-3 space-y-1">
          <div className="flex justify-between text-[13px]"><span className="text-[#565B56]">Monto</span><span className="font-semibold">{dinero(monto, f.moneda)}</span></div>
          {f.iva && <div className="flex justify-between text-[13px]"><span className="text-[#565B56]">IVA 21%</span><span className="font-semibold">{dinero(iva, f.moneda)}</span></div>}
          <div className="flex justify-between text-[14px] font-bold border-t border-[#E9E4D8] pt-1 mt-1"><span>Total</span><span className="text-[#8A6529]">{dinero(total, f.moneda)}</span></div>
        </div>
      )}
      <p className="text-[11px] text-[#676B63]">Si el cliente tiene acceso al portal, verá este recibo en su cuenta.</p>
    </Modal>
  );
}
