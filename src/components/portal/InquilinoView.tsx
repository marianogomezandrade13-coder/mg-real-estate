"use client";

import { useMemo, useState } from "react";
import { FileSignature, Wallet, Receipt, FolderOpen, FileText, MessageCircle } from "lucide-react";
import { PortalShell, BotonDescarga, type Tab } from "./PortalShell";
import { dinero, fechaCorta, mesAnio, proximoVencimiento } from "@/lib/format";
import { waLink } from "@/lib/brand";
import { mapaEmbedUrl } from "@/lib/propiedades";
import type { DatosInquilino } from "@/lib/portal-data";
import { cn } from "@/lib/utils";

const TABS: Tab[] = [
  { id: "contrato", label: "Mi contrato", icon: FileSignature },
  { id: "cuenta", label: "Cuenta", icon: Wallet },
  { id: "recibos", label: "Recibos", icon: Receipt },
  { id: "documentos", label: "Documentos", icon: FolderOpen },
];

type Movimiento = { k: string; fecha: string; concepto: string; monto: number; moneda: "USD" | "ARS"; estado: "pagado" | "pendiente" | "vencido" };
const card = "bg-white rounded-[16px] border border-[#E9E4D8]";
const Vacio = ({ titulo, texto }: { titulo: string; texto: string }) => (
  <div className={cn(card, "p-8 text-center")}>
    <p className="text-[15px] font-semibold text-[#1F2421]">{titulo}</p>
    <p className="text-[13px] text-[#676B63] mt-1">{texto}</p>
  </div>
);

export function InquilinoView({
  nombre, data, logoutSlot,
}: { nombre: string; data: DatosInquilino; logoutSlot: React.ReactNode }) {
  const [tab, setTab] = useState("contrato");
  const { alquiler, propiedad, contrato, recibos, documentos } = data;

  const venc = useMemo(() => (alquiler ? proximoVencimiento(alquiler.dia_vencimiento) : null), [alquiler]);
  const vigente = !!contrato && contrato.estado === "firmado" && (!contrato.fecha_fin || new Date(contrato.fecha_fin) >= new Date());

  // Estado de cuenta: recibos emitidos (pagados) + el período en curso si está pendiente o vencido
  const movimientos = useMemo(() => {
    const filas: Movimiento[] = recibos.map((r) => ({
      k: r.id, fecha: r.fecha, concepto: r.concepto, monto: r.total, moneda: r.moneda as "USD" | "ARS", estado: "pagado",
    }));
    if (alquiler && alquiler.estado_pago !== "al_dia") {
      filas.unshift({
        k: "pendiente", fecha: (venc ?? new Date()).toISOString().slice(0, 10), concepto: "Alquiler del período en curso",
        monto: alquiler.canon, moneda: contrato?.moneda ?? "ARS", estado: alquiler.estado_pago === "vencido" ? "vencido" : "pendiente",
      });
    }
    return filas;
  }, [recibos, alquiler, venc, contrato]);

  const badge = (e: string) =>
    e === "pagado" ? { t: "Pagado", c: "bg-[#EAF7F0] text-[#1F9D5B]" }
    : e === "vencido" ? { t: "Vencido", c: "bg-[#FBECEF] text-[#C0506A]" }
    : { t: "Pendiente", c: "bg-[#FBF3E2] text-[#8A5A0F]" };

  const subt: Record<string, string> = {
    contrato: "Tu contrato de alquiler vigente.", cuenta: "Historial de pagos y saldo pendiente.",
    recibos: "Tus comprobantes de pago.", documentos: "Tus documentos disponibles.",
  };

  const pagar = alquiler && propiedad
    ? waLink(`Hola, quiero coordinar el pago del alquiler de ${propiedad.codigo} (${propiedad.titulo}) por ${dinero(alquiler.canon)}.`)
    : waLink("Hola, quiero coordinar el pago de mi alquiler.");

  return (
    <PortalShell tabs={TABS} tab={tab} onTab={setTab} user={{ nombre, rol: "Inquilino" }} logoutSlot={logoutSlot}>
      {data.error && (
        <p role="alert" className="mb-5 text-[13px] text-[#C0506A] bg-[#FBECEF] rounded-[10px] px-4 py-3">
          No pudimos cargar toda tu información ahora. Intentá de nuevo en unos minutos.
        </p>
      )}
      <div className="mb-6">
        <h1 className="text-[26px] sm:text-[28px] font-bold text-[#16201B]">Hola, {nombre.split(" ")[0]}</h1>
        <p className="text-[#676B63] mt-1 text-[14px]">{subt[tab]}</p>
      </div>

      {tab === "contrato" && (!alquiler || !propiedad ? (
        <Vacio titulo="Todavía no tenés un contrato asociado" texto="Cuando la inmobiliaria lo vincule a tu cuenta, vas a ver acá todos los datos." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          <div className={cn(card, "p-5 sm:p-6")}>
            <div className="flex items-start justify-between gap-3 mb-5">
              <h2 className="text-[16px] font-bold text-[#1F2421]">{propiedad.titulo}</h2>
              <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0", vigente ? "bg-[#EAF7F0] text-[#1F9D5B]" : "bg-[#F6F3EC] text-[#676B63]")}>
                {vigente ? "Vigente" : contrato?.estado ?? "—"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Inicio", value: mesAnio(contrato?.fecha_inicio) },
                { label: "Vencimiento", value: mesAnio(contrato?.fecha_fin) },
                { label: "Canon actual", value: dinero(alquiler.canon) },
                { label: "Próximo ajuste", value: `${mesAnio(alquiler.proximo_ajuste)} · ${alquiler.indice}` },
                { label: "Dirección", value: propiedad.direccion ?? propiedad.ciudad ?? "—" },
                { label: "Código", value: propiedad.codigo },
              ].map((f) => (
                <div key={f.label} className="p-3 bg-[#F6F3EC] rounded-[10px] min-w-0">
                  <p className="text-[10px] text-[#676B63] uppercase tracking-wide">{f.label}</p>
                  <p className="text-[14px] font-bold text-[#1F2421] mt-0.5 break-words">{f.value}</p>
                </div>
              ))}
            </div>
            {contrato && (
              <BotonDescarga tipo="contrato" id={contrato.id} disponible={!!contrato.pdf_url}
                className="w-full mt-5 py-3 bg-[#16201B] !text-white !no-underline font-semibold rounded-[10px] hover:bg-[#1F2C26] text-[13px]">
                Descargar contrato PDF
              </BotonDescarga>
            )}
            {propiedad.direccion && (
              <div className="mt-5 overflow-hidden rounded-[12px] border border-[#E9E4D8]">
                <iframe title={`Mapa: ${propiedad.direccion}`} src={mapaEmbedUrl(propiedad.direccion)} loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade" className="w-full h-[220px] block" />
              </div>
            )}
          </div>

          <div className="bg-[#8A6529] rounded-[16px] p-5 sm:p-6 flex flex-col justify-between gap-6">
            <div>
              <p className="text-white/85 text-[13px] font-semibold mb-2">Próximo vencimiento</p>
              <p className="text-white text-[34px] sm:text-[40px] font-bold font-[family-name:var(--font-space-grotesk)] break-words">{dinero(alquiler.canon)}</p>
              {venc && <p className="text-white/80 text-[13px] mt-2">Vence el {fechaCorta(venc.toISOString().slice(0, 10))}</p>}
            </div>
            <a href={pagar} target="_blank" rel="noopener noreferrer"
              className="w-full py-3.5 bg-white text-[#6E4F1F] font-bold rounded-[12px] hover:bg-[#F6F3EC] transition-colors flex items-center justify-center gap-2">
              <MessageCircle size={17} />Pagar ahora
            </a>
            <p className="text-white/75 text-[11px] -mt-3 text-center">Se abre WhatsApp para coordinar el pago con la inmobiliaria.</p>
          </div>
        </div>
      ))}

      {tab === "cuenta" && (movimientos.length === 0 ? (
        <Vacio titulo="Sin movimientos todavía" texto="Tus pagos y vencimientos van a aparecer acá." />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {movimientos.map((m) => (
              <div key={m.k} className={cn(card, "p-4 flex items-center justify-between gap-3")}>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#1F2421] truncate">{m.concepto}</p>
                  <p className="text-[11px] text-[#676B63]">{fechaCorta(m.fecha)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[14px] font-bold text-[#1F2421]">{dinero(m.monto, m.moneda)}</p>
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", badge(m.estado).c)}>{badge(m.estado).t}</span>
                </div>
              </div>
            ))}
          </div>
          <div className={cn(card, "hidden md:block overflow-hidden")}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E9E4D8]">
                  {["Fecha", "Concepto", "Monto", "Estado"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold text-[#676B63] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => (
                  <tr key={m.k} className="border-b border-[#F6F3EC] hover:bg-[#F6EEDD] transition-colors">
                    <td className="px-5 py-3 text-[13px] text-[#565B56]">{fechaCorta(m.fecha)}</td>
                    <td className="px-5 py-3 text-[13px] font-semibold text-[#1F2421]">{m.concepto}</td>
                    <td className="px-5 py-3 text-[14px] font-bold text-[#1F2421]">{dinero(m.monto, m.moneda)}</td>
                    <td className="px-5 py-3"><span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full", badge(m.estado).c)}>{badge(m.estado).t}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ))}

      {tab === "recibos" && (recibos.length === 0 ? (
        <Vacio titulo="Todavía no hay recibos" texto="Cada pago que registremos genera un recibo que vas a poder descargar acá." />
      ) : (
        <div className="space-y-3">
          {recibos.map((r) => (
            <div key={r.id} className={cn(card, "p-4 sm:p-5 flex items-center justify-between gap-3")}>
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-11 h-11 rounded-[12px] bg-[#F6EEDD] flex items-center justify-center text-[#8A6529] shrink-0"><Receipt size={18} /></div>
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-[#1F2421] truncate">{r.concepto}</p>
                  <p className="text-[12px] font-mono text-[#8A6529]">{r.numero}</p>
                  <p className="text-[12px] text-[#676B63]">Emitido el {fechaCorta(r.fecha)}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[17px] sm:text-[20px] font-bold text-[#8A6529] font-[family-name:var(--font-space-grotesk)]">{dinero(r.total, r.moneda as "USD" | "ARS")}</p>
                <BotonDescarga tipo="recibo" id={r.id} disponible={!!r.pdf_url} className="ml-auto">Descargar</BotonDescarga>
              </div>
            </div>
          ))}
        </div>
      ))}

      {tab === "documentos" && (documentos.length === 0 ? (
        <Vacio titulo="No hay documentos disponibles" texto="Tu contrato, inventario y reglamento aparecerán acá cuando los compartamos." />
      ) : (
        <div className="space-y-3">
          {documentos.map((d) => (
            <div key={d.id} className={cn(card, "p-4 flex items-center justify-between gap-3")}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-[10px] bg-[#FBECEF] flex items-center justify-center text-[#C0506A] shrink-0"><FileText size={17} /></div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#1F2421] truncate">{d.nombre}</p>
                  <p className="text-[11px] text-[#676B63] capitalize">{fechaCorta(d.fecha)} · {d.categoria}</p>
                </div>
              </div>
              <BotonDescarga tipo="documento" id={d.id} className="shrink-0" />
            </div>
          ))}
        </div>
      ))}
    </PortalShell>
  );
}
