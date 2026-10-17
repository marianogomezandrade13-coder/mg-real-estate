"use client";

import { useMemo, useState } from "react";
import { LayoutDashboard, Building2, Receipt, FolderOpen, FileText, Circle, MapPin } from "lucide-react";
import { PortalShell, BotonDescarga, type Tab } from "./PortalShell";
import { dinero, periodo, fechaCorta, mesAnio } from "@/lib/format";
import { mapaEmbedUrl } from "@/lib/propiedades";
import type { DatosPropietario } from "@/lib/portal-data";
import { cn } from "@/lib/utils";

const TABS: Tab[] = [
  { id: "resumen", label: "Resumen", icon: LayoutDashboard },
  { id: "propiedades", label: "Propiedades", icon: Building2 },
  { id: "liquidaciones", label: "Liquidaciones", icon: Receipt },
  { id: "documentos", label: "Documentos", icon: FolderOpen },
];

const card = "bg-white rounded-[16px] border border-[#E9E4D8]";
const Vacio = ({ titulo, texto }: { titulo: string; texto: string }) => (
  <div className={cn(card, "p-8 text-center")}>
    <p className="text-[15px] font-semibold text-[#1F2421]">{titulo}</p>
    <p className="text-[13px] text-[#676B63] mt-1">{texto}</p>
  </div>
);

export function PropietarioView({
  nombre, data, logoutSlot,
}: { nombre: string; data: DatosPropietario; logoutSlot: React.ReactNode }) {
  const [tab, setTab] = useState("resumen");
  const [mapaAbierto, setMapaAbierto] = useState<string | null>(null);
  const { propiedades, liquidaciones, documentos } = data;

  const kpi = useMemo(() => {
    const alquiladas = propiedades.filter((p) => p.alquiler).length;
    const renta = propiedades.reduce((s, p) => s + (p.alquiler?.canon ?? 0), 0);
    const ultima = liquidaciones[0];
    return {
      total: propiedades.length,
      renta,
      neto: ultima?.neto ?? null,
      periodoNeto: ultima ? periodo(ultima.periodo) : null,
      ocupacion: propiedades.length ? Math.round((alquiladas / propiedades.length) * 100) : 0,
    };
  }, [propiedades, liquidaciones]);

  const proxima = liquidaciones.find((l) => l.estado === "Aprobada") ?? liquidaciones[0];

  const actividad = useMemo(() => {
    const a = [
      ...liquidaciones.map((l) => ({
        k: l.id, fecha: l.created_at, color: l.estado === "Pagada" ? "#1F9D5B" : "#8A6529",
        texto: l.estado === "Pagada" ? `Liquidación de ${periodo(l.periodo)} pagada` : `Liquidación de ${periodo(l.periodo)} disponible`,
      })),
      ...documentos.map((d) => ({ k: d.id, fecha: d.fecha, color: "#E0A93B", texto: `Nuevo documento: ${d.nombre}` })),
    ];
    return a.sort((x, y) => y.fecha.localeCompare(x.fecha)).slice(0, 5);
  }, [liquidaciones, documentos]);

  return (
    <PortalShell tabs={TABS} tab={tab} onTab={setTab} user={{ nombre, rol: "Propietario" }} logoutSlot={logoutSlot}>
      {data.error && (
        <p role="alert" className="mb-5 text-[13px] text-[#C0506A] bg-[#FBECEF] rounded-[10px] px-4 py-3">
          No pudimos cargar toda tu información ahora. Intentá de nuevo en unos minutos.
        </p>
      )}

      {tab === "resumen" && (
        <>
          <div className="mb-6">
            <h1 className="text-[26px] sm:text-[28px] font-bold text-[#16201B]">Hola, {nombre.split(" ")[0]}</h1>
            <p className="text-[#676B63] mt-1 text-[14px]">Este es el resumen de tus propiedades en administración.</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            {[
              { label: "Propiedades", value: String(kpi.total), color: "text-[#1F2421]" },
              { label: "Renta mensual", value: kpi.renta ? dinero(kpi.renta) : "—", color: "text-[#8A6529]" },
              { label: kpi.periodoNeto ? `Neto · ${kpi.periodoNeto}` : "Último neto", value: kpi.neto != null ? dinero(kpi.neto) : "—", color: "text-[#1F9D5B]" },
              { label: "Ocupación", value: `${kpi.ocupacion}%`, color: "text-[#1F2421]" },
            ].map((k) => (
              <div key={k.label} className={cn(card, "p-4 sm:p-5")}>
                <p className="text-[12px] text-[#676B63]">{k.label}</p>
                <p className={cn("text-[22px] sm:text-[26px] font-bold mt-1 font-[family-name:var(--font-space-grotesk)] break-words", k.color)}>{k.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            <div className={cn(card, "p-5 sm:p-6")}>
              <h2 className="text-[15px] font-bold text-[#1F2421] mb-4">Próxima liquidación</h2>
              {proxima ? (
                <>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-[#1F2421] truncate">{proxima.propiedadTitulo}</p>
                      <p className="text-[12px] text-[#676B63]">{periodo(proxima.periodo)}</p>
                    </div>
                    <p className="text-[22px] font-bold text-[#8A6529] font-[family-name:var(--font-space-grotesk)] shrink-0">{dinero(proxima.neto)}</p>
                  </div>
                  <BotonDescarga tipo="liquidacion" id={proxima.id} disponible={!!proxima.pdf_url}
                    className="w-full py-3 bg-[#16201B] !text-white !no-underline font-semibold rounded-[10px] hover:bg-[#1F2C26] text-[13px]">
                    Descargar liquidación PDF
                  </BotonDescarga>
                </>
              ) : <p className="text-[13px] text-[#676B63]">Todavía no hay liquidaciones disponibles.</p>}
            </div>

            <div className={cn(card, "p-5 sm:p-6")}>
              <h2 className="text-[15px] font-bold text-[#1F2421] mb-4">Actividad reciente</h2>
              {actividad.length ? (
                <div className="space-y-4">
                  {actividad.map((a) => (
                    <div key={a.k} className="flex items-start gap-3">
                      <Circle size={8} className="mt-1.5 flex-shrink-0" style={{ fill: a.color, color: a.color }} />
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-[#1F2421] break-words">{a.texto}</p>
                        <p className="text-[11px] text-[#676B63]">{fechaCorta(a.fecha)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-[13px] text-[#676B63]">Sin movimientos por ahora.</p>}
            </div>
          </div>
        </>
      )}

      {tab === "propiedades" && (
        <>
          <h1 className="text-[24px] font-bold text-[#16201B] mb-5">Mis propiedades</h1>
          {propiedades.length === 0 ? <Vacio titulo="Todavía no tenés propiedades asociadas" texto="Cuando la inmobiliaria las vincule a tu cuenta, las vas a ver acá." /> : (
            <div className="space-y-3 sm:space-y-4">
              {propiedades.map((p) => (
                <div key={p.id} className={cn(card, "p-4 sm:p-5")}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15px] font-bold text-[#1F2421]">{p.titulo}</p>
                      <p className="text-[12px] font-mono text-[#8A6529] mt-0.5">{p.codigo}</p>
                      {p.alquiler ? <p className="text-[12px] text-[#676B63] mt-1">Inquilino: {p.alquiler.inquilino}</p>
                        : p.direccion && <p className="text-[12px] text-[#676B63] mt-1">{p.direccion}</p>}
                    </div>
                    <div className="sm:text-right flex sm:block items-center justify-between gap-3">
                      <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full",
                        p.estado === "Alquilada" || p.alquiler ? "bg-[#EAF7F0] text-[#1F9D5B]" : "bg-[#F6EEDD] text-[#6E4F1F]")}>
                        {p.alquiler ? "Alquilada" : p.estado}
                      </span>
                      {p.alquiler && (
                        <p className="text-[18px] font-bold text-[#8A6529] sm:mt-2 font-[family-name:var(--font-space-grotesk)]">{dinero(p.alquiler.canon)}<span className="text-[12px] font-medium text-[#676B63]">/mes</span></p>
                      )}
                      {p.alquiler && <p className="hidden sm:block text-[11px] text-[#676B63]">Próx. ajuste {mesAnio(p.alquiler.proximoAjuste)} · {p.alquiler.indice}</p>}
                    </div>
                  </div>
                  {p.direccion && (
                    <>
                      <button type="button" onClick={() => setMapaAbierto((v) => (v === p.id ? null : p.id))}
                        className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#8A6529] hover:text-[#6E4F1F]">
                        <MapPin size={13} />{mapaAbierto === p.id ? "Ocultar mapa" : "Ver ubicación en el mapa"}
                      </button>
                      {mapaAbierto === p.id && (
                        <div className="mt-3 overflow-hidden rounded-[12px] border border-[#E9E4D8]">
                          <iframe title={`Mapa: ${p.direccion}`} src={mapaEmbedUrl(p.direccion)} loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade" className="w-full h-[220px] block" />
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "liquidaciones" && (
        <>
          <h1 className="text-[24px] font-bold text-[#16201B] mb-5">Liquidaciones</h1>
          {liquidaciones.length === 0 ? <Vacio titulo="Aún no hay liquidaciones" texto="Se publican acá cuando la inmobiliaria las aprueba." /> : (
            <>
              {/* Tarjetas (celular) */}
              <div className="space-y-3 md:hidden">
                {liquidaciones.map((l) => (
                  <div key={l.id} className={cn(card, "p-4")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[14px] font-bold text-[#1F2421]">{periodo(l.periodo)}</p>
                        <p className="text-[12px] text-[#676B63] truncate">{l.propiedadTitulo}</p>
                      </div>
                      <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0", l.estado === "Pagada" ? "bg-[#EAF7F0] text-[#1F9D5B]" : "bg-[#F6EEDD] text-[#6E4F1F]")}>
                        {l.estado === "Pagada" ? "Pagada" : "Disponible"}
                      </span>
                    </div>
                    <dl className="grid grid-cols-3 gap-2 mt-3 text-[12px]">
                      <div><dt className="text-[#676B63]">Bruto</dt><dd className="font-semibold text-[#1F2421]">{dinero(l.alquiler_cobrado)}</dd></div>
                      <div><dt className="text-[#676B63]">Comisión</dt><dd className="font-semibold text-[#C0506A]">- {dinero(l.comision)}</dd></div>
                      <div><dt className="text-[#676B63]">Neto</dt><dd className="font-bold text-[#8A6529]">{dinero(l.neto)}</dd></div>
                    </dl>
                    <BotonDescarga tipo="liquidacion" id={l.id} disponible={!!l.pdf_url} className="mt-2">Descargar PDF</BotonDescarga>
                  </div>
                ))}
              </div>
              {/* Tabla (pantallas grandes) */}
              <div className={cn(card, "hidden md:block overflow-hidden")}>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E9E4D8]">
                      {["Período", "Propiedad", "Bruto", "Comisión", "Neto a recibir", "Estado", ""].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#676B63] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {liquidaciones.map((l) => (
                      <tr key={l.id} className="border-b border-[#F6F3EC] hover:bg-[#F6EEDD] transition-colors">
                        <td className="px-4 py-3 text-[13px] font-semibold text-[#1F2421]">{periodo(l.periodo)}</td>
                        <td className="px-4 py-3 text-[12px] text-[#565B56]">{l.propiedadTitulo}</td>
                        <td className="px-4 py-3 text-[13px] font-semibold text-[#1F2421]">{dinero(l.alquiler_cobrado)}</td>
                        <td className="px-4 py-3 text-[12px] text-[#C0506A]">- {dinero(l.comision)}</td>
                        <td className="px-4 py-3 text-[14px] font-bold text-[#8A6529]">{dinero(l.neto)}</td>
                        <td className="px-4 py-3">
                          <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full", l.estado === "Pagada" ? "bg-[#EAF7F0] text-[#1F9D5B]" : "bg-[#F6EEDD] text-[#6E4F1F]")}>
                            {l.estado === "Pagada" ? "Pagada" : "Disponible"}
                          </span>
                        </td>
                        <td className="px-4 py-3"><BotonDescarga tipo="liquidacion" id={l.id} disponible={!!l.pdf_url}>PDF</BotonDescarga></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {tab === "documentos" && (
        <>
          <h1 className="text-[24px] font-bold text-[#16201B] mb-5">Mis documentos</h1>
          {documentos.length === 0 ? <Vacio titulo="No hay documentos disponibles" texto="Los contratos y comprobantes que te compartamos aparecerán acá." /> : (
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
          )}
        </>
      )}
    </PortalShell>
  );
}
