"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, FileText, MessageCircle, Mail, Loader2, Receipt, Search } from "lucide-react";
import { PageHeader } from "@/components/panel/PageHeader";
import { EmitirRecibo } from "@/components/panel/EmitirRecibo";
import { Vacio, ErrorCarga, btnPrimario, inputCls } from "@/components/panel/ui";
import { sb, listarClientes, nombreCliente, fechaAR, telefonoWa, urlTemporal, type Cliente } from "@/lib/panel-db";
import { archivarPdfRecibo, type ReciboRow } from "@/lib/panel-recibos";
import { dinero } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function RecibosPage() {
  const [recibos, setRecibos] = useState<ReciboRow[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emitir, setEmitir] = useState(false);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const cargar = useCallback(async () => {
    try {
      const [r, c] = await Promise.all([sb.from("recibos").select("*").order("created_at", { ascending: false }), listarClientes()]);
      if (r.error) throw new Error(r.error.message);
      setError(null); setRecibos(r.data ?? []); setClientes(c);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const t = setTimeout(() => void cargar(), 0); return () => clearTimeout(t); }, [cargar]);

  const porId = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);
  const visibles = useMemo(() => {
    const b = q.trim().toLowerCase();
    return b ? recibos.filter((r) => [r.numero, r.concepto, nombreCliente(porId.get(r.cliente_id))].some((t) => t.toLowerCase().includes(b))) : recibos;
  }, [recibos, q, porId]);

  const descargar = async (r: ReciboRow) => {
    setTrabajando(r.id);
    try {
      if (r.pdf_url) {
        window.location.assign(await urlTemporal("pdfs", r.pdf_url));
      } else {
        // Sin PDF archivado todavía: se genera, se guarda para el cliente y se descarga
        const { doc, path } = await archivarPdfRecibo(r, porId.get(r.cliente_id));
        doc.save(`Recibo-${r.numero.replace("#", "")}.pdf`);
        setRecibos((rs) => rs.map((x) => (x.id === r.id ? { ...x, pdf_url: path } : x)));
        toast.success("PDF generado y disponible para el cliente");
      }
    } catch (e) { toast.error("No se pudo obtener el PDF: " + (e as Error).message); }
    finally { setTrabajando(null); }
  };

  const acciones = (r: ReciboRow) => {
    const cli = porId.get(r.cliente_id);
    const tel = telefonoWa(cli?.telefono);
    const msg = `Hola ${cli?.nombre ?? ""}, te enviamos el recibo ${r.numero} (${r.concepto}) por ${dinero(r.total, r.moneda)}.`;
    return (
      <div className="flex items-center gap-1">
        <button onClick={() => void descargar(r)} disabled={trabajando === r.id} className="p-2 rounded-[6px] text-[#676B63] hover:bg-[#F6F3EC] disabled:opacity-60" title="Descargar PDF" aria-label={`Descargar PDF del recibo ${r.numero}`}>
          {trabajando === r.id ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
        </button>
        <a href={`mailto:${cli?.email ?? ""}?subject=${encodeURIComponent(`Recibo ${r.numero}`)}&body=${encodeURIComponent(msg)}`} className="p-2 rounded-[6px] text-[#676B63] hover:bg-[#F6F3EC]" title="Enviar por email" aria-label="Enviar por email"><Mail size={14} /></a>
        <a href={tel ? `https://wa.me/${tel}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-[6px] text-[#1F9D5B] hover:bg-[#EAF7F0]" title="Enviar por WhatsApp" aria-label="Enviar por WhatsApp"><MessageCircle size={14} /></a>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-7 space-y-5">
      <PageHeader title="Recibos" subtitle="Emisión y archivo de comprobantes de pago"
        action={<button onClick={() => setEmitir(true)} className={btnPrimario}><Plus size={15} /> Emitir recibo</button>} />

      {!loading && !error && recibos.length > 0 && (
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A3A69C]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número, cliente o concepto…" aria-label="Buscar recibo" className={cn(inputCls, "pl-9")} />
        </div>
      )}

      <div className="bg-white rounded-[16px] shadow-card overflow-hidden">
        {loading ? <div className="flex items-center justify-center py-16 text-[#676B63]"><Loader2 size={20} className="animate-spin mr-2" />Cargando recibos…</div>
        : error ? <ErrorCarga mensaje={error} onReintentar={() => { setLoading(true); void cargar(); }} />
        : recibos.length === 0 ? <Vacio icono={<Receipt size={24} />} titulo="Todavía no emitiste recibos" texto="Cada recibo queda archivado y el cliente puede descargarlo desde su portal." accion={<button onClick={() => setEmitir(true)} className={btnPrimario}>Emitir el primero</button>} />
        : visibles.length === 0 ? <p className="text-center py-12 text-[13px] text-[#676B63]">Sin resultados para “{q}”.</p>
        : (
          <>
            <div className="md:hidden divide-y divide-[#F6F3EC]">
              {visibles.map((r) => (
                <div key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[12px] font-mono font-bold text-[#8A6529]">{r.numero} · {fechaAR(r.fecha)}</p>
                      <p className="text-[14px] font-semibold text-[#1F2421] truncate">{nombreCliente(porId.get(r.cliente_id))}</p>
                      <p className="text-[12px] text-[#676B63] line-clamp-2">{r.concepto}</p>
                    </div>
                    <p className="text-[15px] font-bold text-[#1F2421] shrink-0">{dinero(r.total, r.moneda)}</p>
                  </div>
                  <div className="mt-2">{acciones(r)}</div>
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead><tr className="border-b border-[#E9E4D8]">
                  {["Nº", "Fecha", "Cliente", "Concepto", "Monto", "IVA", "Total", ""].map((h) => <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#676B63] uppercase tracking-wider">{h}</th>)}
                </tr></thead>
                <tbody>
                  {visibles.map((r) => (
                    <tr key={r.id} className="border-b border-[#F6F3EC] hover:bg-[#F6EEDD] transition-colors">
                      <td className="px-4 py-3 text-[12px] font-mono font-bold text-[#8A6529]">{r.numero}</td>
                      <td className="px-4 py-3 text-[12px] text-[#676B63]">{fechaAR(r.fecha)}</td>
                      <td className="px-4 py-3 text-[13px] font-semibold text-[#1F2421]">{nombreCliente(porId.get(r.cliente_id))}</td>
                      <td className="px-4 py-3 text-[13px] text-[#565B56] max-w-[240px] truncate" title={r.concepto}>{r.concepto}</td>
                      <td className="px-4 py-3 text-[13px] text-[#1F2421]">{dinero(r.honorarios, r.moneda)}</td>
                      <td className="px-4 py-3 text-[13px] text-[#565B56]">{r.iva ? dinero(r.iva, r.moneda) : "—"}</td>
                      <td className="px-4 py-3 text-[14px] font-bold text-[#1F2421]">{dinero(r.total, r.moneda)}</td>
                      <td className="px-4 py-3">{acciones(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {emitir && (
        <EmitirRecibo clientes={clientes} onClienteCreado={(c) => setClientes((cs) => [...cs, c])}
          onClose={() => setEmitir(false)} onEmitido={(r) => setRecibos((rs) => [r, ...rs])} />
      )}
    </div>
  );
}
