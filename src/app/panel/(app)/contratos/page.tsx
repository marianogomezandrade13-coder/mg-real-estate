"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FileSignature, Loader2, FileText, Trash2, Upload, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/panel/PageHeader";
import { Field, Vacio, ErrorCarga, inputCls, labelCls, btnPrimario } from "@/components/panel/ui";
import { ClienteSelect } from "@/components/panel/ClienteSelect";
import { sb, nombreCliente, dniCliente, fechaAR, hoyISO, subirArchivo, urlTemporal, listarClientes, type Cliente } from "@/lib/panel-db";
import { siguienteNumeroContrato, archivarPdfContrato, type ContratoRow } from "@/lib/panel-contratos";
import { tituloContrato, type DatosContrato, type TipoOperacion, type TipoInmueble, type Regimen } from "@/lib/contratos-clausulas";
import { useEsTitular } from "@/lib/rol-context";
import { cn } from "@/lib/utils";

type Prop = { id: string; codigo: string; titulo: string; tipo: string; direccion: string | null; propietario_id: string | null };

const OPERACIONES: { id: TipoOperacion; label: string }[] = [{ id: "alquiler", label: "Alquiler" }, { id: "compraventa", label: "Compraventa" }, { id: "comodato", label: "Comodato" }];
const INMUEBLES: TipoInmueble[] = ["Casa", "Departamento", "PH", "Finca", "Oficina", "Local", "Lote"];
const AJUSTES = ["Sin ajuste pactado", "ICL (BCRA)", "IPC (INDEC)", "Índice privado / CVS", "A convenir libremente entre las partes"];
const ROLES: Record<TipoOperacion, [string, string]> = { alquiler: ["Locador", "Locatario"], compraventa: ["Vendedor", "Comprador"], comodato: ["Comodante", "Comodatario"] };
const destinoSugerido = (op: TipoOperacion, tipo: TipoInmueble, regimen: Regimen) => {
  if (op === "compraventa") return "";
  if (regimen === "rural") return "explotación agropecuaria";
  if (tipo === "Oficina" || tipo === "Local") return "uso comercial";
  if (tipo === "Casa" || tipo === "Departamento" || tipo === "PH") return "vivienda familiar";
  return "";
};

const FORM0 = {
  propiedadId: "", operacion: "alquiler" as TipoOperacion, inmuebleTipo: "Casa" as TipoInmueble, regimen: "urbano" as Regimen,
  direccion: "", parteAId: "", parteBId: "", destino: destinoSugerido("alquiler", "Casa", "urbano"),
  monto: "", moneda: "ARS" as "ARS" | "USD", deposito: "", plazoMeses: "12", fechaInicio: hoyISO(), fechaFin: "",
  ajusteTipo: AJUSTES[0], ajusteFrecuenciaMeses: "3", senia: "", plazoEscrituracionDias: "60", clausulasParticulares: "", lugarFirma: "San Martín, Mendoza",
};
type Form = typeof FORM0;

const ESTADO_STYLE: Record<ContratoRow["estado"], string> = { borrador: "bg-[#FBF3E2] text-[#8A5A0F]", enviado: "bg-[#EAF0FB] text-[#2F5FA8]", firmado: "bg-[#EAF7F0] text-[#1F9D5B]" };
const TIPO_LABEL: Record<ContratoRow["tipo"], string> = { alq_viv: "Alquiler vivienda", alq_com: "Alquiler comercial", compraventa: "Compraventa", comodato: "Comodato", reserva: "Reserva", admin: "Administración" };

export default function ContratosPage() {
  const esTitular = useEsTitular();
  const [contratos, setContratos] = useState<ContratoRow[]>([]);
  const [props, setProps] = useState<Prop[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<Form>(FORM0);
  const [generando, setGenerando] = useState(false);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const contratoParaSubir = useRef<ContratoRow | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [c, p, cl] = await Promise.all([
        sb.from("contratos").select("*").order("created_at", { ascending: false }),
        sb.from("propiedades").select("id,codigo,titulo,tipo,direccion,propietario_id").order("codigo"),
        listarClientes(),
      ]);
      if (c.error) throw new Error(c.error.message);
      setError(null); setContratos(c.data ?? []); setProps(p.data ?? []); setClientes(cl);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const t = setTimeout(() => void cargar(), 0); return () => clearTimeout(t); }, [cargar]);

  const cliPorId = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);
  const propPorId = useMemo(() => new Map(props.map((p) => [p.id, p])), [props]);
  const [rolA, rolB] = ROLES[form.operacion];

  const elegirPropiedad = (id: string) => {
    const p = props.find((x) => x.id === id);
    setForm((f) => ({
      ...f, propiedadId: id, direccion: p?.direccion || f.direccion,
      inmuebleTipo: (INMUEBLES.includes(p?.tipo as TipoInmueble) ? p!.tipo : f.inmuebleTipo) as TipoInmueble,
      parteAId: p?.propietario_id || f.parteAId,
    }));
  };
  const cambiarOperacion = (operacion: TipoOperacion) => setForm((f) => ({ ...f, operacion, destino: destinoSugerido(operacion, f.inmuebleTipo, f.regimen) }));
  const cambiarInmueble = (inmuebleTipo: TipoInmueble) => setForm((f) => ({ ...f, inmuebleTipo, regimen: inmuebleTipo === "Finca" ? "rural" : f.regimen, destino: destinoSugerido(f.operacion, inmuebleTipo, inmuebleTipo === "Finca" ? "rural" : f.regimen) }));
  const cambiarRegimen = (regimen: Regimen) => setForm((f) => ({ ...f, regimen, destino: destinoSugerido(f.operacion, f.inmuebleTipo, regimen) }));

  const armarDatos = (): DatosContrato | null => {
    const parteA = cliPorId.get(form.parteAId), parteB = cliPorId.get(form.parteBId);
    if (!parteA || !parteB) { toast.error(`Elegí ${!parteA ? `el ${rolA.toLowerCase()}` : `el ${rolB.toLowerCase()}`}`); return null; }
    if (parteA.id === parteB.id) { toast.error("Las dos partes no pueden ser la misma persona"); return null; }
    if (!form.direccion.trim()) { toast.error("Ingresá la dirección del inmueble"); return null; }
    return {
      operacion: form.operacion, inmuebleTipo: form.inmuebleTipo, regimen: form.regimen, direccion: form.direccion.trim(),
      codigoPropiedad: propPorId.get(form.propiedadId)?.codigo ?? null,
      parteA: { nombre: nombreCliente(parteA), dni: dniCliente(parteA), rol: rolA }, parteB: { nombre: nombreCliente(parteB), dni: dniCliente(parteB), rol: rolB },
      destino: form.destino, monto: form.monto ? parseFloat(form.monto) : null, moneda: form.moneda,
      deposito: form.deposito ? parseFloat(form.deposito) : null, plazoMeses: form.plazoMeses ? parseInt(form.plazoMeses, 10) : null,
      fechaInicio: form.fechaInicio || null, fechaFin: form.fechaFin || null,
      ajusteTipo: form.ajusteTipo, ajusteFrecuenciaMeses: form.ajusteFrecuenciaMeses ? parseInt(form.ajusteFrecuenciaMeses, 10) : null,
      senia: form.senia ? parseFloat(form.senia) : null, plazoEscrituracionDias: form.plazoEscrituracionDias ? parseInt(form.plazoEscrituracionDias, 10) : null,
      clausulasParticulares: form.clausulasParticulares, lugarFirma: form.lugarFirma,
    };
  };

  const generar = async () => {
    const datos = armarDatos();
    if (!datos) return;
    setGenerando(true);
    try {
      const numero = await siguienteNumeroContrato();
      const tipoDb: ContratoRow["tipo"] = form.operacion === "compraventa" ? "compraventa" : form.operacion === "comodato" ? "comodato"
        : (form.inmuebleTipo === "Casa" || form.inmuebleTipo === "Departamento" || form.inmuebleTipo === "PH") ? "alq_viv" : "alq_com";
      const { data, error } = await sb.from("contratos").insert({
        tipo: tipoDb, propiedad_id: form.propiedadId || null, parte_a_id: form.parteAId, parte_b_id: form.parteBId,
        monto: datos.monto, moneda: form.moneda, indice_ajuste: null, fecha_inicio: datos.fechaInicio, fecha_fin: datos.fechaFin,
        estado: "borrador", pdf_url: null, sucursal_id: null,
        cuerpo: { numero, ...datos },
      }).select("*").single();
      if (error || !data) throw new Error(error?.message ?? "No se pudo crear el contrato");

      let doc;
      try { ({ doc } = await archivarPdfContrato(data.id, numero, datos)); }
      catch (e) {
        await sb.from("contratos").delete().eq("id", data.id);
        throw new Error("No se pudo generar el PDF, no se guardó el contrato. Probá de nuevo. " + (e as Error).message);
      }
      doc.save(`${tituloContrato(datos).replace(/\s+/g, "-")}-${numero}.pdf`);
      setContratos((xs) => [{ ...data, pdf_url: `contratos/${data.id}.pdf` }, ...xs]);
      setForm(FORM0);
      toast.success(`${numero} generado y descargado.`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setGenerando(false); }
  };

  const descargar = async (c: ContratoRow) => {
    setTrabajando(c.id);
    try { if (c.pdf_url) window.location.assign(await urlTemporal("pdfs", c.pdf_url)); }
    catch (e) { toast.error("No se pudo descargar: " + (e as Error).message); }
    finally { setTrabajando(null); }
  };

  const marcarFirmado = async (c: ContratoRow) => {
    const { data, error } = await sb.from("contratos").update({ estado: "firmado" }).eq("id", c.id).select("*").single();
    if (error || !data) return void toast.error(error?.message ?? "No se pudo actualizar");
    setContratos((xs) => xs.map((x) => (x.id === c.id ? data : x)));
    toast.success("Marcado como firmado");
  };

  const eliminar = async (c: ContratoRow) => {
    if (!confirm("¿Eliminar este contrato?")) return;
    const { error } = await sb.from("contratos").delete().eq("id", c.id);
    if (error) return void toast.error(error.message);
    if (c.pdf_url) await sb.storage.from("pdfs").remove([c.pdf_url]);
    setContratos((xs) => xs.filter((x) => x.id !== c.id));
    toast.success("Contrato eliminado");
  };

  const elegirArchivo = (c: ContratoRow) => { contratoParaSubir.current = c; fileRef.current?.click(); };
  const subirFirmado = async (files: FileList | null) => {
    const f = files?.[0]; const c = contratoParaSubir.current;
    if (fileRef.current) fileRef.current.value = "";
    if (!f || !c) return;
    if (f.type !== "application/pdf") return void toast.error("Subí un PDF");
    setTrabajando(c.id);
    try {
      const path = `contratos/${c.id}.pdf`;
      await subirArchivo("pdfs", path, f);
      const { data, error } = await sb.from("contratos").update({ pdf_url: path, estado: "firmado" }).eq("id", c.id).select("*").single();
      if (error || !data) throw new Error(error?.message ?? "No se pudo guardar");
      setContratos((xs) => xs.map((x) => (x.id === c.id ? data : x)));
      toast.success("Contrato firmado archivado");
    } catch (e) { toast.error((e as Error).message); }
    finally { setTrabajando(null); }
  };

  return (
    <div className="p-4 sm:p-7 space-y-6">
      <PageHeader title="Generador de contratos" subtitle="Alquiler, compraventa y comodato adaptados al tipo de inmueble" />

      {!esTitular && (
        <div className="bg-white rounded-[16px] shadow-card p-6 text-center text-[13px] text-[#676B63]">
          Solo la titular puede generar contratos nuevos. Podés ver y descargar los ya generados más abajo.
        </div>
      )}

      {esTitular && (
      <div className="bg-white rounded-[16px] shadow-card p-5 sm:p-6 space-y-5">
        <h2 className="text-[16px] font-bold text-[#1F2421]">Nuevo contrato</h2>

        <div>
          <label className={labelCls}>Operación</label>
          <div className="flex bg-[#E9E4D8] rounded-[10px] p-1 w-fit">
            {OPERACIONES.map((o) => (
              <button key={o.id} type="button" onClick={() => cambiarOperacion(o.id)} className={cn("px-4 py-1.5 rounded-[8px] text-[13px] font-semibold transition-colors", form.operacion === o.id ? "bg-white text-[#1F2421] shadow-sm" : "text-[#676B63]")}>{o.label}</button>
            ))}
          </div>
        </div>

        {props.length > 0 && (
          <Field label="Propiedad (opcional, autocompleta datos)">
            <select value={form.propiedadId} onChange={(e) => elegirPropiedad(e.target.value)} className={inputCls}>
              <option value="">Sin vincular</option>
              {props.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.titulo}</option>)}
            </select>
          </Field>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Tipo de inmueble"><select value={form.inmuebleTipo} onChange={(e) => cambiarInmueble(e.target.value as TipoInmueble)} className={inputCls}>{INMUEBLES.map((t) => <option key={t}>{t}</option>)}</select></Field>
          {form.operacion === "alquiler" && (
            <Field label="Régimen" hint={form.regimen === "rural" ? "Explotación agropecuaria: puede regirse por la Ley 13.246, distinta a la locación urbana." : undefined}>
              <select value={form.regimen} onChange={(e) => cambiarRegimen(e.target.value as Regimen)} className={inputCls}><option value="urbano">Urbano</option><option value="rural">Rural (explotación agropecuaria)</option></select>
            </Field>
          )}
        </div>

        <Field label="Dirección del inmueble"><input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} className={inputCls} placeholder="Ej: Belgrano 450, San Martín, Mendoza" /></Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={rolA}><ClienteSelect value={form.parteAId} onChange={(id) => setForm({ ...form, parteAId: id })} clientes={clientes} onCreado={(c) => setClientes((cs) => [...cs, c])} tipos={["propietario", "lead", "otro"]} tipoNuevo="propietario" placeholder={`Elegí el ${rolA.toLowerCase()}`} /></Field>
          <Field label={rolB}><ClienteSelect value={form.parteBId} onChange={(id) => setForm({ ...form, parteBId: id })} clientes={clientes} onCreado={(c) => setClientes((cs) => [...cs, c])} tipos={["inquilino", "lead", "otro"]} tipoNuevo="inquilino" placeholder={`Elegí el ${rolB.toLowerCase()}`} /></Field>
        </div>

        <Field label="Destino / uso"><input value={form.destino} onChange={(e) => setForm({ ...form, destino: e.target.value })} className={inputCls} placeholder="Ej: vivienda familiar" /></Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={form.operacion === "compraventa" ? "Precio total" : "Monto mensual"}><input type="number" inputMode="decimal" min="0" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} className={inputCls} /></Field>
          <Field label="Moneda"><select value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value as "ARS" | "USD" })} className={inputCls}><option>ARS</option><option>USD</option></select></Field>
        </div>

        {form.operacion === "alquiler" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Plazo (meses)"><input type="number" min="1" value={form.plazoMeses} onChange={(e) => setForm({ ...form, plazoMeses: e.target.value })} className={inputCls} /></Field>
              <Field label="Inicio"><input type="date" value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} className={inputCls} /></Field>
              <Field label="Fin"><input type="date" value={form.fechaFin} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })} className={inputCls} /></Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Depósito en garantía"><input type="number" inputMode="decimal" min="0" value={form.deposito} onChange={(e) => setForm({ ...form, deposito: e.target.value })} className={inputCls} placeholder="Opcional" /></Field>
              <Field label="Mecanismo de ajuste"><select value={form.ajusteTipo} onChange={(e) => setForm({ ...form, ajusteTipo: e.target.value })} className={inputCls}>{AJUSTES.map((a) => <option key={a}>{a}</option>)}</select></Field>
              <Field label="Frecuencia (meses)"><input type="number" min="1" value={form.ajusteFrecuenciaMeses} onChange={(e) => setForm({ ...form, ajusteFrecuenciaMeses: e.target.value })} className={inputCls} /></Field>
            </div>
          </>
        )}

        {form.operacion === "comodato" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Plazo (meses)"><input type="number" min="1" value={form.plazoMeses} onChange={(e) => setForm({ ...form, plazoMeses: e.target.value })} className={inputCls} /></Field>
            <Field label="Inicio"><input type="date" value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} className={inputCls} /></Field>
          </div>
        )}

        {form.operacion === "compraventa" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Seña (opcional)"><input type="number" inputMode="decimal" min="0" value={form.senia} onChange={(e) => setForm({ ...form, senia: e.target.value })} className={inputCls} /></Field>
            <Field label="Plazo de escrituración (días)"><input type="number" min="1" value={form.plazoEscrituracionDias} onChange={(e) => setForm({ ...form, plazoEscrituracionDias: e.target.value })} className={inputCls} /></Field>
          </div>
        )}

        <Field label="Cláusulas particulares (opcional)"><textarea value={form.clausulasParticulares} onChange={(e) => setForm({ ...form, clausulasParticulares: e.target.value })} rows={3} className="w-full border border-[#E9E4D8] rounded-[9px] px-3 py-2 text-[13px] outline-none focus:border-[#8A6529] resize-none" placeholder="Cualquier condición adicional acordada entre las partes" /></Field>
        <Field label="Lugar de firma"><input value={form.lugarFirma} onChange={(e) => setForm({ ...form, lugarFirma: e.target.value })} className={inputCls} /></Field>

        <button onClick={() => void generar()} disabled={generando} className={cn(btnPrimario, "w-full")}>
          {generando ? <Loader2 size={15} className="animate-spin" /> : <FileSignature size={15} />}{generando ? "Generando…" : `Generar ${tituloContrato({ operacion: form.operacion, regimen: form.regimen }).toLowerCase()}`}
        </button>
      </div>
      )}

      <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => void subirFirmado(e.target.files)} />

      <div className="bg-white rounded-[16px] shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E9E4D8]"><h2 className="text-[15px] font-bold text-[#1F2421]">Contratos generados</h2></div>
        {loading ? <div className="flex items-center justify-center py-16 text-[#676B63]"><Loader2 size={20} className="animate-spin mr-2" />Cargando…</div>
        : error ? <ErrorCarga mensaje={error} onReintentar={() => { setLoading(true); void cargar(); }} />
        : contratos.length === 0 ? <Vacio icono={<FileText size={24} />} titulo="Todavía no generaste contratos" texto="Completá el formulario de arriba para generar el primero." />
        : (
          <div className="divide-y divide-[#F6F3EC]">
            {contratos.map((c) => {
              const cuerpo = c.cuerpo as { numero?: string } | null;
              return (
                <div key={c.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-mono font-bold text-[#8A6529]">{cuerpo?.numero ?? "—"} · {TIPO_LABEL[c.tipo]}</p>
                    <p className="text-[13px] font-semibold text-[#1F2421] truncate">{nombreCliente(cliPorId.get(c.parte_a_id))} / {nombreCliente(cliPorId.get(c.parte_b_id))}</p>
                    <p className="text-[11px] text-[#676B63]">{c.propiedad_id ? propPorId.get(c.propiedad_id)?.codigo : "sin propiedad vinculada"} · {fechaAR(c.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full capitalize", ESTADO_STYLE[c.estado])}>{c.estado}</span>
                    <button onClick={() => void descargar(c)} disabled={trabajando === c.id} className="p-2 rounded-[6px] text-[#676B63] hover:bg-[#F6F3EC]" title="Descargar PDF" aria-label="Descargar PDF">{trabajando === c.id ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}</button>
                    {esTitular && <button onClick={() => elegirArchivo(c)} className="p-2 rounded-[6px] text-[#676B63] hover:bg-[#F6F3EC]" title="Subir versión firmada" aria-label="Subir versión firmada"><Upload size={14} /></button>}
                    {esTitular && c.estado !== "firmado" && <button onClick={() => void marcarFirmado(c)} className="p-2 rounded-[6px] text-[#1F9D5B] hover:bg-[#EAF7F0]" title="Marcar como firmado" aria-label="Marcar como firmado"><CheckCircle2 size={14} /></button>}
                    {esTitular && <button onClick={() => void eliminar(c)} className="p-2 rounded-[6px] text-[#C0506A] hover:bg-[#FBECEF]" title="Eliminar" aria-label="Eliminar"><Trash2 size={14} /></button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
