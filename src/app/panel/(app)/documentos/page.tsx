"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Search, Plus, Trash2, FileText, File as FileIcon, Image as ImageIcon, Loader2, Download, FolderOpen } from "lucide-react";
import { PageHeader } from "@/components/panel/PageHeader";
import { Modal, Field, Vacio, ErrorCarga, inputCls, btnPrimario, btnSecundario } from "@/components/panel/ui";
import { sb, listarClientes, nombreCliente, fechaAR, subirArchivo, urlTemporal, type Cliente } from "@/lib/panel-db";
import { useEsTitular } from "@/lib/rol-context";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type Doc = Database["public"]["Tables"]["documentos"]["Row"];
type Categoria = Doc["categoria"];
type Permiso = Doc["permiso"];

const CATEGORIAS: { id: Categoria; label: string }[] = [
  { id: "contratos", label: "Contratos" }, { id: "escrituras", label: "Escrituras" }, { id: "tasaciones", label: "Tasaciones" },
  { id: "recibos", label: "Recibos" }, { id: "dni", label: "DNI / CUIT" }, { id: "comprobantes", label: "Comprobantes" },
];
const PERMISOS: { id: Permiso; label: string; hint: string; cls: string }[] = [
  { id: "equipo", label: "Equipo", hint: "Lo ve el personal", cls: "bg-[#EAF0FB] text-[#2F5FA8]" },
  { id: "cliente", label: "Cliente", hint: "Lo ve también el cliente vinculado en su portal", cls: "bg-[#EAF7F0] text-[#1F9D5B]" },
  { id: "privado", label: "Privado", hint: "Solo el titular", cls: "bg-[#FBECEF] text-[#C0506A]" },
  { id: "solo_lectura", label: "Solo lectura", hint: "El equipo lo ve, sin modificar", cls: "bg-[#F6F3EC] text-[#565B56]" },
];
const permisoDe = (p: Permiso) => PERMISOS.find((x) => x.id === p)!;
const MAX_MB = 20;

const iconoDe = (n: string) => {
  const e = n.split(".").pop()?.toLowerCase() ?? "";
  if (e === "pdf") return { i: <FileText size={15} className="text-[#C0506A]" />, bg: "bg-[#FBECEF]" };
  if (["jpg", "jpeg", "png", "webp", "heic"].includes(e)) return { i: <ImageIcon size={15} className="text-[#1F9D5B]" />, bg: "bg-[#EAF7F0]" };
  return { i: <FileIcon size={15} className="text-[#2F5FA8]" />, bg: "bg-[#EAF0FB]" };
};
const limpiar = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80);

type Form = { archivo: File | null; nombre: string; categoria: Categoria; vinculo: string; permiso: Permiso };

export default function DocumentosPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [props, setProps] = useState<{ id: string; codigo: string; titulo: string }[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<Categoria | "todos">("todos");
  const [q, setQ] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    try {
      const [d, p, c] = await Promise.all([
        sb.from("documentos").select("*").order("created_at", { ascending: false }),
        sb.from("propiedades").select("id,codigo,titulo").order("codigo"),
        listarClientes(),
      ]);
      if (d.error) throw new Error(d.error.message);
      setError(null); setDocs(d.data ?? []); setProps(p.data ?? []); setClientes(c);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const t = setTimeout(() => void cargar(), 0); return () => clearTimeout(t); }, [cargar]);

  const cliPorId = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);
  const propPorCodigo = useMemo(() => new Map(props.map((p) => [p.codigo, p])), [props]);
  const etiquetaVinculo = useCallback((v: string | null) => {
    if (!v) return "—";
    const p = propPorCodigo.get(v); if (p) return `${p.codigo} · ${p.titulo}`;
    const c = cliPorId.get(v); return c ? nombreCliente(c) : v;
  }, [propPorCodigo, cliPorId]);

  const cuenta = useMemo(() => { const m: Record<string, number> = {}; docs.forEach((d) => { m[d.categoria] = (m[d.categoria] ?? 0) + 1; }); return m; }, [docs]);
  const visibles = useMemo(() => {
    const b = q.trim().toLowerCase();
    return docs.filter((d) => (categoria === "todos" || d.categoria === categoria) && (!b || d.nombre.toLowerCase().includes(b) || etiquetaVinculo(d.vinculado_a).toLowerCase().includes(b)));
  }, [docs, categoria, q, etiquetaVinculo]);

  const elegirArchivo = (files: FileList | null) => {
    const f = files?.[0]; if (fileRef.current) fileRef.current.value = "";
    if (!f) return;
    if (f.size > MAX_MB * 1024 * 1024) return void toast.error(`El archivo supera los ${MAX_MB} MB`);
    setForm((x) => (x ? { ...x, archivo: f, nombre: x.nombre || f.name } : x));
  };

  const subir = async () => {
    const f = form!;
    if (!f.archivo) return void toast.error("Elegí un archivo");
    if (!f.nombre.trim()) return void toast.error("Escribí un nombre");
    if (f.permiso === "cliente" && !f.vinculo) return void toast.error("Para que lo vea un cliente, vinculalo a una propiedad o a una persona");
    setSaving(true);
    let path = "";
    try {
      const nombre = f.nombre.trim();
      // Máximo existente + 1 (no la cantidad de filas): si se borró una versión intermedia, contar filas
      // repetiría un número de versión ya usado en vez de seguir la numeración real.
      const version = 1 + docs.filter((d) => d.nombre === nombre && d.vinculado_a === (f.vinculo || null)).reduce((max, d) => Math.max(max, d.version), 0);
      path = `${f.categoria}/${crypto.randomUUID()}-${limpiar(f.archivo.name)}`;
      await subirArchivo("documentos", path, f.archivo, f.archivo.type || "application/octet-stream");
      const { data, error } = await sb.from("documentos").insert({
        nombre, categoria: f.categoria, vinculado_a: f.vinculo || null, storage_path: path, version, permiso: f.permiso, subido_por: null, sucursal_id: null,
      }).select("*").single();
      if (error || !data) { await sb.storage.from("documentos").remove([path]); throw new Error(error?.message ?? "No se pudo registrar"); }
      setDocs((ds) => [data, ...ds]); setForm(null);
      toast.success(version > 1 ? `Documento subido (versión ${version})` : "Documento subido");
    } catch (e) { toast.error("No se pudo subir: " + (e as Error).message); }
    finally { setSaving(false); }
  };

  const abrir = async (d: Doc) => {
    setTrabajando(d.id);
    try { window.open(await urlTemporal("documentos", d.storage_path), "_blank", "noopener"); }
    catch (e) { toast.error("No se pudo abrir: " + (e as Error).message); }
    finally { setTrabajando(null); }
  };

  const eliminar = async (d: Doc) => {
    if (!confirm(`¿Eliminar "${d.nombre}"? También se borra el archivo y deja de verlo el cliente.`)) return;
    setTrabajando(d.id);
    const { error } = await sb.from("documentos").delete().eq("id", d.id);
    if (error) { setTrabajando(null); return void toast.error(error.message); }
    await sb.storage.from("documentos").remove([d.storage_path]);
    setDocs((ds) => ds.filter((x) => x.id !== d.id)); setTrabajando(null); toast.success("Documento eliminado");
  };

  const cambiarPermiso = async (d: Doc, permiso: Permiso) => {
    if (permiso === "cliente" && !d.vinculado_a) return void toast.error("Vinculalo a una propiedad o persona para compartirlo con un cliente");
    const { data, error } = await sb.from("documentos").update({ permiso }).eq("id", d.id).select("*").single();
    if (error || !data) return void toast.error(error?.message ?? "No se pudo cambiar");
    setDocs((ds) => ds.map((x) => (x.id === d.id ? data : x)));
  };

  const esTitular = useEsTitular();
  const selPermiso = (d: Doc) => !esTitular ? (
    <span className={cn("text-[11px] font-semibold rounded-full px-2.5 py-1", permisoDe(d.permiso).cls)} title={permisoDe(d.permiso).hint}>{permisoDe(d.permiso).label}</span>
  ) : (
    <select value={d.permiso} onChange={(e) => void cambiarPermiso(d, e.target.value as Permiso)} aria-label="Permiso" title={permisoDe(d.permiso).hint}
      className={cn("text-[11px] font-semibold rounded-full px-2.5 py-1 outline-none cursor-pointer border-0 appearance-none", permisoDe(d.permiso).cls)}>
      {PERMISOS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
    </select>
  );
  const botones = (d: Doc) => (
    <div className="flex items-center gap-0.5">
      <button onClick={() => void abrir(d)} disabled={trabajando === d.id} className="p-2 rounded-[6px] text-[#676B63] hover:bg-[#F6F3EC]" title="Abrir / descargar" aria-label="Abrir o descargar">
        {trabajando === d.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
      </button>
      {esTitular && <button onClick={() => void eliminar(d)} disabled={trabajando === d.id} className="p-2 rounded-[6px] text-[#C0506A] hover:bg-[#FBECEF]" title="Eliminar" aria-label="Eliminar"><Trash2 size={14} /></button>}
    </div>
  );

  return (
    <div className="p-4 sm:p-7 space-y-6">
      <PageHeader title="Repositorio documental" subtitle="Archivos con versionado y permisos"
        action={esTitular && <button onClick={() => setForm({ archivo: null, nombre: "", categoria: categoria === "todos" ? "contratos" : categoria, vinculo: "", permiso: "equipo" })} className={btnPrimario}><Plus size={15} /> Subir documento</button>} />

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A3A69C]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, propiedad o cliente…" aria-label="Buscar documento" className={cn(inputCls, "pl-9 bg-white shadow-card")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="lg:col-span-1 bg-white rounded-[16px] shadow-card p-3 lg:p-4">
          <p className="hidden lg:block text-[10px] font-bold text-[#676B63] uppercase tracking-wider px-2 mb-2">Carpetas</p>
          <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {([{ id: "todos", label: "Todos" }, ...CATEGORIAS] as { id: Categoria | "todos"; label: string }[]).map((c) => {
              const n = c.id === "todos" ? docs.length : (cuenta[c.id] ?? 0);
              return (
                <button key={c.id} onClick={() => setCategoria(c.id)} aria-pressed={categoria === c.id}
                  className={cn("shrink-0 lg:w-full flex items-center justify-between gap-3 px-3 py-2 rounded-[9px] text-[13px] font-medium transition-colors", categoria === c.id ? "bg-[#F6EEDD] text-[#8A6529] font-bold" : "text-[#565B56] hover:bg-[#F6F3EC]")}>
                  {c.label}<span className={cn("text-[11px] font-bold", categoria === c.id ? "text-[#8A6529]" : "text-[#676B63]")}>{n}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-3 bg-white rounded-[16px] shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E9E4D8] flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-[#1F2421]">{categoria === "todos" ? "Todos los documentos" : CATEGORIAS.find((c) => c.id === categoria)?.label}</h2>
            <span className="text-[12px] text-[#676B63]">{visibles.length} archivos</span>
          </div>
          {loading ? <div className="flex items-center justify-center py-16 text-[#676B63]"><Loader2 size={20} className="animate-spin mr-2" />Cargando…</div>
          : error ? <ErrorCarga mensaje={error} onReintentar={() => { setLoading(true); void cargar(); }} />
          : visibles.length === 0 ? <Vacio icono={<FolderOpen size={24} />} titulo={docs.length === 0 ? "Todavía no hay documentos" : "Sin resultados"}
              texto={docs.length === 0 ? "Subí contratos, escrituras, DNI o comprobantes. Los que marques para “Cliente” los ve el cliente vinculado en su portal." : undefined}
              accion={docs.length === 0 && esTitular ? <button onClick={() => setForm({ archivo: null, nombre: "", categoria: "contratos", vinculo: "", permiso: "equipo" })} className={btnPrimario}>Subir el primero</button> : undefined} />
          : (
            <>
              <div className="md:hidden divide-y divide-[#F6F3EC]">
                {visibles.map((d) => { const ic = iconoDe(d.nombre); return (
                  <div key={d.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <span className={cn("w-9 h-9 rounded-[8px] grid place-items-center shrink-0", ic.bg)}>{ic.i}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-[#1F2421] break-words">{d.nombre}</p>
                        <p className="text-[12px] text-[#676B63]">{etiquetaVinculo(d.vinculado_a)} · v{d.version} · {fechaAR(d.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">{selPermiso(d)}{botones(d)}</div>
                  </div>); })}
              </div>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead><tr className="border-b border-[#E9E4D8]">
                    {["Documento", "Vinculado a", "Subido", "Versión", "Permiso", ""].map((h) => <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#676B63] uppercase tracking-wider">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {visibles.map((d) => { const ic = iconoDe(d.nombre); return (
                      <tr key={d.id} className="border-b border-[#F6F3EC] hover:bg-[#F6EEDD] transition-colors">
                        <td className="px-4 py-3"><div className="flex items-center gap-2"><span className={cn("w-8 h-8 rounded-[8px] grid place-items-center shrink-0", ic.bg)}>{ic.i}</span><span className="text-[13px] font-semibold text-[#1F2421]">{d.nombre}</span></div></td>
                        <td className="px-4 py-3 text-[12px] text-[#565B56]">{etiquetaVinculo(d.vinculado_a)}</td>
                        <td className="px-4 py-3 text-[12px] text-[#676B63]">{fechaAR(d.created_at)}</td>
                        <td className="px-4 py-3"><span className="text-[11px] font-bold text-[#8A6529] bg-[#F6EEDD] px-2 py-0.5 rounded-full">v{d.version}</span></td>
                        <td className="px-4 py-3">{selPermiso(d)}</td>
                        <td className="px-4 py-3">{botones(d)}</td>
                      </tr>); })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {form && (
        <Modal titulo="Subir documento" onClose={() => setForm(null)} ancho="sm:max-w-md"
          footer={<><button onClick={() => setForm(null)} className={`${btnSecundario} flex-1`}>Cancelar</button>
            <button onClick={() => void subir()} disabled={saving} className={`${btnPrimario} flex-1`}>{saving && <Loader2 size={14} className="animate-spin" />}{saving ? "Subiendo…" : "Subir"}</button></>}>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => elegirArchivo(e.target.files)} />
          <button type="button" onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-[#D9BC85] rounded-[12px] py-6 px-4 text-center hover:bg-[#F6EEDD] transition-colors">
            <span className="block text-[13px] font-semibold text-[#8A6529]">{form.archivo ? form.archivo.name : "Elegir archivo"}</span>
            <span className="block text-[11px] text-[#676B63] mt-0.5">{form.archivo ? `${(form.archivo.size / 1024 / 1024).toFixed(2)} MB` : `PDF, imagen o documento · hasta ${MAX_MB} MB`}</span>
          </button>
          <Field label="Nombre"><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className={inputCls} placeholder="Ej: Contrato de alquiler MG-0012" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Carpeta"><select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value as Categoria })} className={inputCls}>{CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></Field>
            <Field label="Permiso"><select value={form.permiso} onChange={(e) => setForm({ ...form, permiso: e.target.value as Permiso })} className={inputCls}>{PERMISOS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
          </div>
          <Field label="Vinculado a" hint={permisoDe(form.permiso).hint + (form.permiso === "cliente" ? ": elegí la propiedad o la persona." : "")}>
            <select value={form.vinculo} onChange={(e) => setForm({ ...form, vinculo: e.target.value })} className={inputCls}>
              <option value="">Sin vincular</option>
              <optgroup label="Propiedades">{props.map((p) => <option key={p.id} value={p.codigo}>{p.codigo} · {p.titulo}</option>)}</optgroup>
              <optgroup label="Personas">{clientes.map((c) => <option key={c.id} value={c.id}>{nombreCliente(c)}</option>)}</optgroup>
            </select>
          </Field>
          <p className="text-[11px] text-[#676B63]">Si subís un archivo con el mismo nombre y vínculo, se guarda como una nueva versión.</p>
        </Modal>
      )}
    </div>
  );
}
