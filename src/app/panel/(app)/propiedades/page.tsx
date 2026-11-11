"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { createBrowserClient } from "@supabase/ssr";
import {
  Plus, X, Pencil, RotateCcw, Trash2, Loader2, ImagePlus, Globe, EyeOff, ExternalLink, Star, Home, Search, Sparkles, Share2,
} from "lucide-react";
import { generarPublicacionIA } from "@/lib/ia-publicacion";
import { geocodificarZona } from "@/lib/geocodificar";
import { PageHeader } from "@/components/panel/PageHeader";
import { comprimirImagen } from "@/lib/imagen";
import { revalidarSitioPublico } from "@/lib/revalidar";
import { mapaEmbedUrl, rutaPropiedad, normalizarCodigo } from "@/lib/propiedades";
import { useEsTitular } from "@/lib/rol-context";
import { cn } from "@/lib/utils";
import { formatPrecio } from "@/lib/propiedades";
import type { Database } from "@/types/database";

type Fila = Database["public"]["Tables"]["propiedades"]["Row"];
type Tipo = Fila["tipo"];
type Estado = Fila["estado"];

const supabase = createBrowserClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const BUCKET = "propiedades";
const MAX_FOTOS = 12;

const ESTADO_STYLE: Record<string, string> = {
  Activa: "bg-[#EAF7F0] text-[#1F9D5B]", Reservada: "bg-[#FBF3E2] text-[#8A5A0F]",
  Vendida: "bg-[#FBECEF] text-[#C0506A]", Alquilada: "bg-[#EAF0FB] text-[#3B82C4]",
};
const TIPOS: Tipo[] = ["Casa", "Departamento", "PH", "Finca", "Oficina", "Local", "Lote"];
const ESTADOS: Estado[] = ["Activa", "Reservada", "Vendida", "Alquilada"];
const COMODIDADES = ["Cochera", "Pileta", "Parrilla", "Jardín", "Balcón", "Terraza", "Ascensor", "Aire acondicionado", "Calefacción", "Seguridad 24 hs", "Agua corriente", "Gas natural", "Cloacas", "Internet", "Amoblado"];

const input = "w-full h-11 sm:h-10 border border-[#E9E4D8] rounded-[9px] px-3 text-[16px] sm:text-[13px] outline-none focus:border-[#8A6529] focus:ring-4 focus:ring-[#8A6529]/15 bg-white";
const label = "block text-[12px] font-semibold text-[#565B56] mb-1";

const FORM0 = {
  titulo: "", codigo: "", propietario_id: "", operacion: "Venta" as Fila["operacion"], tipo: "Casa" as Tipo, estado: "Activa" as Estado,
  moneda: "USD" as Fila["moneda"], precio: "", direccion: "", barrio: "", ciudad: "", ambientes: "", dormitorios: "", banos: "", cocheras: "",
  m2_cubiertos: "", m2_totales: "", antiguedad: "", expensas: "", descripcion: "", publicada_web: false,
};
type Form = typeof FORM0;

/** Foto en edición: ya guardada (tiene id/url) o nueva (archivo + vista previa). El orden del arreglo es el orden en el sitio. */
type Item = { k: string; id?: string; url: string; file?: File };

const num = (v: string) => (v.trim() === "" ? null : Number(v));
const int = (v: string) => (v.trim() === "" ? null : Math.round(Number(v)));

async function siguienteCodigo() {
  const { data } = await supabase.from("propiedades").select("codigo").like("codigo", "MG-%").order("codigo", { ascending: false }).limit(1);
  const n = data?.[0] ? parseInt(data[0].codigo.replace(/\D/g, ""), 10) || 0 : 0;
  return `MG-${String(n + 1).padStart(4, "0")}`;
}

/** Path del archivo dentro del bucket a partir de su URL pública. */
const pathDeUrl = (url: string) => decodeURIComponent(url.split(`/object/public/${BUCKET}/`)[1] ?? "");

export default function PropiedadesPage() {
  const [props, setProps] = useState<Fila[]>([]);
  const [portadas, setPortadas] = useState<Record<string, string>>({});
  const [propietarios, setPropietarios] = useState<{ id: string; nombre: string; apellido: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const [modal, setModal] = useState<null | { editar: Fila | null }>(null);
  const [form, setForm] = useState<Form>(FORM0);
  const [comodidades, setComodidades] = useState<string[]>([]);
  const [otra, setOtra] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [originales, setOriginales] = useState<Item[]>([]);
  const [saving, setSaving] = useState(false);
  const [subiendo, setSubiendo] = useState<{ actual: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000); // si la base no responde no dejamos la pantalla cargando para siempre
    try {
      const { data, error } = await supabase.from("propiedades").select("*").order("created_at", { ascending: false }).abortSignal(ctrl.signal);
      if (error) { setLoadError(error.message); return; }
      setLoadError(null);
      setProps(data ?? []);
      const [{ data: medios }, { data: cl }] = await Promise.all([
        supabase.from("propiedad_medios").select("propiedad_id,url,orden").eq("tipo", "foto").order("orden", { ascending: true }),
        supabase.from("clientes").select("id,nombre,apellido").eq("tipo", "propietario").order("apellido"),
      ]);
      const mapa: Record<string, string> = {};
      for (const m of medios ?? []) if (!(m.propiedad_id in mapa)) mapa[m.propiedad_id] = m.url;
      setPortadas(mapa);
      setPropietarios(cl ?? []);
    } catch (e) {
      setLoadError((e as Error).name === "AbortError" ? "La base de datos no respondió a tiempo." : (e as Error).message);
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, []);

  useEffect(() => { const t = setTimeout(() => void cargar(), 0); return () => clearTimeout(t); }, [cargar]);

  // Propiedades cargadas antes de existir el mapa: se ubican solas, de a una (límite del servicio de mapas).
  const ubicando = useRef(false);
  const puedeEditar = useEsTitular();
  useEffect(() => {
    if (ubicando.current || !puedeEditar) return; // solo el titular puede guardar cambios en propiedades
    const pendientes = props.filter((p) => p.lat == null && (p.barrio || p.ciudad));
    if (pendientes.length === 0) return;
    ubicando.current = true;
    (async () => {
      let hechas = 0;
      for (const p of pendientes) {
        const c = await geocodificarZona(p.barrio, p.ciudad);
        if (c) {
          const { error } = await supabase.from("propiedades").update({ lat: c.lat, lng: c.lng }).eq("id", p.id);
          if (!error) { hechas++; setProps((ps) => ps.map((x) => (x.id === p.id ? { ...x, lat: c.lat, lng: c.lng } : x))); }
        }
        await new Promise((ok) => setTimeout(ok, 1100));
      }
      if (hechas > 0) { void revalidarSitioPublico().catch(() => {}); toast.success(`${hechas} ${hechas === 1 ? "propiedad ubicada" : "propiedades ubicadas"} en el mapa del sitio`); }
    })();
  }, [props, puedeEditar]);

  const reintentar = () => { setLoading(true); void cargar(); };
  const actualizarSitio = () => { void revalidarSitioPublico().catch(() => {}); };

  /* ------------------------------ Acciones de lista ------------------------------ */
  const cambiarEstado = async (p: Fila, estado: Estado) => {
    const publicada_web = estado === "Activa" ? p.publicada_web : false;
    const { error } = await supabase.from("propiedades").update({ estado, publicada_web }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    setProps((ps) => ps.map((x) => (x.id === p.id ? { ...x, estado, publicada_web } : x)));
    actualizarSitio();
    toast.success(`Marcada como ${estado}`);
  };

  const toggleWeb = async (p: Fila) => {
    if (!p.publicada_web && p.estado !== "Activa") { toast.error("Solo se publican propiedades en estado Activa"); return; }
    const { error } = await supabase.from("propiedades").update({ publicada_web: !p.publicada_web }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    setProps((ps) => ps.map((x) => (x.id === p.id ? { ...x, publicada_web: !p.publicada_web } : x)));
    actualizarSitio();
    toast.success(!p.publicada_web ? "Publicada en el sitio web" : "Quitada del sitio web");
  };

  const eliminar = async (p: Fila) => {
    if (!confirm(`¿Eliminar ${p.codigo} · ${p.titulo}? Se borran también sus fotos. No se puede deshacer.`)) return;
    const cuenta = (tabla: "alquileres" | "contratos" | "liquidaciones") =>
      supabase.from(tabla).select("id", { count: "exact", head: true }).eq("propiedad_id", p.id);
    const [al, co, li] = await Promise.all([cuenta("alquileres"), cuenta("contratos"), cuenta("liquidaciones")]);
    const bloqueos = [
      al.count && `${al.count} alquiler(es)`, co.count && `${co.count} contrato(s)`, li.count && `${li.count} liquidación(es)`,
    ].filter(Boolean);
    if (bloqueos.length) {
      const escrito = prompt(
        `${p.codigo} tiene ${bloqueos.join(", ")} asociados.\n\nSi era una propiedad de prueba podés borrar TODO junto (propiedad, alquiler, contratos, liquidaciones y sus PDF). No se puede deshacer y se pierde ese historial.\n\nPara confirmar, escribí el código exacto: ${p.codigo}\n(Si es una propiedad real, cancelá y mejor sacala de la web.)`
      );
      if (escrito === null) return;
      if (escrito.trim() !== p.codigo) { toast.error("El código no coincide: no se borró nada."); return; }
      const [liqs, ctos] = await Promise.all([
        supabase.from("liquidaciones").select("pdf_url").eq("propiedad_id", p.id),
        supabase.from("contratos").select("pdf_url").eq("propiedad_id", p.id),
      ]);
      const r1 = await supabase.from("liquidaciones").delete().eq("propiedad_id", p.id);
      if (r1.error) { toast.error("No se pudieron borrar las liquidaciones: " + r1.error.message); return; }
      const r2 = await supabase.from("alquileres").delete().eq("propiedad_id", p.id);
      if (r2.error) { toast.error("No se pudieron borrar los alquileres: " + r2.error.message); return; }
      const r3 = await supabase.from("contratos").delete().eq("propiedad_id", p.id);
      if (r3.error) { toast.error("No se pudieron borrar los contratos: " + r3.error.message); return; }
      const pdfs = [...(liqs.data ?? []), ...(ctos.data ?? [])].map((x) => x.pdf_url).filter((x): x is string => !!x);
      if (pdfs.length) await supabase.storage.from("pdfs").remove(pdfs);
    }
    const { data: medios } = await supabase.from("propiedad_medios").select("url").eq("propiedad_id", p.id);
    await Promise.all([
      supabase.from("leads").update({ propiedad_id: null }).eq("propiedad_id", p.id),
      supabase.from("eventos_agenda").update({ propiedad_id: null }).eq("propiedad_id", p.id),
    ]);
    const { error } = await supabase.from("propiedades").delete().eq("id", p.id);
    if (error) { toast.error(error.code === "23503" ? "No se puede eliminar: la propiedad todavía está vinculada a otros registros." : error.message); return; }
    const paths = (medios ?? []).map((m) => pathDeUrl(m.url)).filter(Boolean);
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
    setProps((ps) => ps.filter((x) => x.id !== p.id));
    actualizarSitio();
    toast.success("Propiedad eliminada");
  };

  /* --------------------------------- Formulario --------------------------------- */
  const abrir = async (p: Fila | null) => {
    if (!p) {
      setForm(FORM0); setComodidades([]); setItems([]); setOriginales([]); setOtra("");
      setModal({ editar: null });
      return;
    }
    const serv = (p.servicios ?? {}) as { amenities?: string[] };
    setForm({
      titulo: p.titulo, codigo: p.codigo, propietario_id: p.propietario_id ?? "", operacion: p.operacion, tipo: p.tipo, estado: p.estado,
      moneda: p.moneda, precio: String(p.precio ?? ""), direccion: p.direccion ?? "", barrio: p.barrio ?? "", ciudad: p.ciudad ?? "",
      ambientes: String(p.ambientes ?? ""), dormitorios: String(p.dormitorios ?? ""), banos: String(p.banos ?? ""), cocheras: String(p.cocheras ?? ""),
      m2_cubiertos: String(p.m2_cubiertos ?? ""), m2_totales: String(p.m2_totales ?? ""), antiguedad: String(p.antiguedad ?? ""),
      expensas: String(p.expensas ?? ""), descripcion: p.descripcion ?? "", publicada_web: p.publicada_web,
    });
    setComodidades(Array.isArray(serv.amenities) ? serv.amenities : []);
    setOtra("");
    const { data } = await supabase.from("propiedad_medios").select("id,url,orden").eq("propiedad_id", p.id).eq("tipo", "foto").order("orden");
    const ex = (data ?? []).map((m) => ({ k: m.id, id: m.id, url: m.url }));
    setItems(ex); setOriginales(ex);
    setModal({ editar: p });
  };

  const cerrar = () => { items.forEach((i) => i.file && URL.revokeObjectURL(i.url)); setModal(null); };

  const agregarFotos = (files: FileList | null) => {
    if (!files) return;
    const libres = MAX_FOTOS - items.length;
    const nuevas = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, Math.max(0, libres));
    if (files.length > nuevas.length) toast.message(`Máximo ${MAX_FOTOS} fotos por propiedad`);
    setItems((prev) => [...prev, ...nuevas.map((f, i) => ({ k: `n${Date.now()}${i}`, url: URL.createObjectURL(f), file: f }))]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const hacerPrincipal = (k: string) => setItems((prev) => { const it = prev.find((x) => x.k === k)!; return [it, ...prev.filter((x) => x.k !== k)]; });
  const quitarFoto = (k: string) => setItems((prev) => { const it = prev.find((x) => x.k === k); if (it?.file) URL.revokeObjectURL(it.url); return prev.filter((x) => x.k !== k); });
  const toggleComodidad = (c: string) => setComodidades((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));
  const agregarOtra = () => { const v = otra.trim(); if (v && !comodidades.includes(v)) setComodidades((cs) => [...cs, v]); setOtra(""); };

  const guardar = async () => {
    if (!form.titulo.trim()) { toast.error("Completá el título del aviso"); return; }
    const precio = num(form.precio);
    if (precio !== null && (Number.isNaN(precio) || precio < 0)) { toast.error("El precio no es válido"); return; }
    setSaving(true);
    try {
      const editar = modal?.editar ?? null;
      // Ubicación en el mapa del sitio: se recalcula solo si cambió el barrio o la ciudad.
      const zonaIgual = !!editar && (editar.barrio ?? "") === form.barrio.trim() && (editar.ciudad ?? "") === form.ciudad.trim();
      const coords = zonaIgual && editar!.lat != null && editar!.lng != null ? { lat: editar!.lat, lng: editar!.lng }
        : await geocodificarZona(form.barrio.trim() || null, form.ciudad.trim() || null);
      const datos = {
        lat: coords?.lat ?? null, lng: coords?.lng ?? null,
        titulo: form.titulo.trim(), tipo: form.tipo, operacion: form.operacion, estado: form.estado, moneda: form.moneda,
        precio: precio ?? 0, direccion: form.direccion.trim() || null, barrio: form.barrio.trim() || null, ciudad: form.ciudad.trim() || null,
        provincia: "Mendoza", ambientes: int(form.ambientes), dormitorios: int(form.dormitorios), banos: int(form.banos), cocheras: int(form.cocheras),
        m2_cubiertos: num(form.m2_cubiertos), m2_totales: num(form.m2_totales), antiguedad: int(form.antiguedad), expensas: num(form.expensas),
        descripcion: form.descripcion.trim() || null, propietario_id: form.propietario_id || null,
        publicada_web: form.estado === "Activa" ? form.publicada_web : false,
        servicios: { amenities: comodidades },
      };

      let id: string, codigo: string;
      const codigoForm = normalizarCodigo(form.codigo);
      if (form.codigo.trim() && !codigoForm) throw new Error("El código solo puede tener letras, números y guiones");
      if (editar) {
        codigo = codigoForm || editar.codigo;
        const { error } = await supabase.from("propiedades").update({ ...datos, codigo }).eq("id", editar.id);
        if (error) throw new Error(error.code === "23505" ? `El código ${codigo} ya existe en otra propiedad` : error.message);
        id = editar.id;
        if (codigo !== editar.codigo) {
          const { error: eDoc } = await supabase.from("documentos").update({ vinculado_a: codigo }).eq("vinculado_a", editar.codigo);
          if (eDoc) toast.warning("El código cambió, pero no se pudieron actualizar los documentos vinculados: " + eDoc.message);
          actualizarSitio();
        }
      } else {
        codigo = codigoForm || (await siguienteCodigo());
        const base = {
          ...datos, codigo, sucursal_id: null, estado_conservacion: null, patio: null,
        };
        let res = await supabase.from("propiedades").insert(base).select("id").single();
        if (res.error?.code === "23505" && !codigoForm) { // código repetido: se recalcula una vez
          codigo = await siguienteCodigo();
          res = await supabase.from("propiedades").insert({ ...base, codigo }).select("id").single();
        }
        if (res.error || !res.data) throw new Error(res.error?.code === "23505" ? `El código ${codigo} ya existe` : (res.error?.message ?? "No se pudo guardar"));
        id = res.data.id;
      }

      // Fotos: borrar las quitadas, subir las nuevas, y reescribir el orden completo
      const quedan = new Set(items.filter((i) => i.id).map((i) => i.id));
      const quitadas = originales.filter((o) => !quedan.has(o.id));
      if (quitadas.length) {
        await supabase.from("propiedad_medios").delete().in("id", quitadas.map((q2) => q2.id!));
        const paths = quitadas.map((q2) => pathDeUrl(q2.url)).filter(Boolean);
        if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
      }
      let fallidas = 0;
      const nuevasFotos = items.filter((i) => !i.id).length;
      let subidas = 0;
      const subirUna = async (it: Item, k: number) => {
        const blob = await comprimirImagen(it.file!);
        const path = `${id}/${Date.now()}-${k}.jpg`;
        const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (up.error) throw up.error;
        const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        const ins = await supabase.from("propiedad_medios").insert({ propiedad_id: id, tipo: "foto", url, orden: k });
        if (ins.error) throw ins.error;
      };
      for (let k = 0; k < items.length; k++) {
        const it = items[k];
        if (it.id) { await supabase.from("propiedad_medios").update({ orden: k }).eq("id", it.id); continue; }
        if (nuevasFotos > 1) setSubiendo({ actual: subidas + 1, total: nuevasFotos });
        try {
          await subirUna(it, k);
        } catch {
          try { await subirUna(it, k); } // reintento único: suele alcanzar en celulares con red inestable
          catch { fallidas++; }
        }
        subidas++;
        // deja un respiro entre foto y foto para que el navegador libere la memoria de la anterior
        await new Promise((r) => setTimeout(r, 0));
      }
      setSubiendo(null);

      actualizarSitio();
      cerrar();
      void cargar();
      if (fallidas) toast.warning(`${codigo} guardada, pero ${fallidas} foto(s) no se pudieron subir. Editá la propiedad y volvé a agregarlas.`);
      else toast.success(editar ? `${codigo} actualizada` : `Propiedad ${codigo} cargada correctamente`);
    } catch (e) {
      toast.error("No se pudo guardar: " + (e as Error).message);
    } finally {
      setSaving(false);
      setSubiendo(null);
    }
  };

  const visibles = useMemo(() => {
    const b = q.trim().toLowerCase();
    return b ? props.filter((p) => [p.codigo, p.titulo, p.ciudad, p.barrio, p.tipo].some((t) => (t ?? "").toLowerCase().includes(b))) : props;
  }, [props, q]);

  const precioTxt = (p: Fila) => (!p.precio ? "—" : `${p.moneda === "USD" ? "USD" : "$"} ${p.precio.toLocaleString("es-AR")}${p.operacion === "Alquiler" ? "/mes" : ""}`);
  const [generandoIA, setGenerandoIA] = useState(false);
  const generarDescripcion = async () => {
    if (!form.precio.trim()) { toast.error("Completá al menos el precio (y cuantos más datos cargues, mejor) para que la IA tenga datos."); return; }
    if (form.descripcion.trim().length > 20 && !window.confirm("Ya hay una descripción escrita. ¿Reemplazarla por una generada con IA?")) return;
    setGenerandoIA(true);
    try {
      const r = await generarPublicacionIA({
        tipo: form.tipo, operacion: form.operacion, precio: Number(form.precio), moneda: form.moneda,
        direccion: form.direccion.trim() || null, barrio: form.barrio.trim() || null, ciudad: form.ciudad.trim() || null,
        ambientes: num(form.ambientes), dormitorios: num(form.dormitorios), banos: num(form.banos), cocheras: num(form.cocheras),
        m2Cubiertos: num(form.m2_cubiertos), m2Totales: num(form.m2_totales), antiguedad: num(form.antiguedad),
        amenities: comodidades, descripcion: null,
      });
      if (!r.ok) { toast.error(r.error); return; }
      setForm((f) => ({ ...f, descripcion: r.data.descripcion.slice(0, 3000), titulo: f.titulo.trim() ? f.titulo : r.data.titulo }));
      toast.success("Descripción generada. Revisala y ajustá lo que quieras antes de guardar.");
    } catch (e) { toast.error("No se pudo generar: " + (e as Error).message); }
    finally { setGenerandoIA(false); }
  };
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const esTitular = useEsTitular();

  return (
    <div className="p-4 sm:p-7">
      <PageHeader
        title="Cartera de propiedades"
        subtitle="Cargá, editá y publicá los inmuebles que se ven en la web"
        action={esTitular && (
          <button onClick={() => void abrir(null)}
            className="flex items-center gap-2 bg-[#8A6529] text-white text-[13px] font-semibold px-4 py-2.5 rounded-[10px] hover:bg-[#6E4F1F] transition-colors">
            <Plus size={15} /> Cargar propiedad
          </button>
        )}
      />

      {!loading && !loadError && props.length > 0 && (
        <div className="relative max-w-sm mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A3A69C]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código, título o ciudad…" aria-label="Buscar propiedad" className={cn(input, "pl-9")} />
        </div>
      )}

      <div className="bg-white rounded-[16px] shadow-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#676B63]"><Loader2 size={20} className="animate-spin mr-2" /> Cargando propiedades...</div>
        ) : loadError ? (
          <div role="alert" className="text-center py-16 px-6">
            <p className="text-[15px] font-semibold text-[#1F2421]">No pudimos conectar con la base de datos</p>
            <p className="text-[13px] mt-1 text-[#676B63] max-w-md mx-auto">{loadError} Revisá la conexión y las variables de Supabase.</p>
            <button onClick={reintentar} className="mt-5 bg-[#16201B] text-[#D9BC85] text-[13px] font-semibold px-5 py-2.5 rounded-[10px] hover:bg-[#283932] transition-colors">Reintentar</button>
          </div>
        ) : props.length === 0 ? (
          <div className="text-center py-16 px-6">
            <span className="mx-auto grid place-items-center w-14 h-14 rounded-full bg-[#F6EEDD] text-[#8A6529]"><Home size={24} /></span>
            <p className="text-[15px] font-semibold mt-4 text-[#1F2421]">Todavía no hay propiedades cargadas</p>
            <p className="text-[13px] mt-1 text-[#676B63]">Cargá la primera y publicala para que aparezca en la web.</p>
            {esTitular && <button onClick={() => void abrir(null)} className="mt-5 bg-[#8A6529] text-white text-[13px] font-semibold px-5 py-2.5 rounded-[10px] hover:bg-[#6E4F1F]">Cargar propiedad</button>}
          </div>
        ) : visibles.length === 0 ? (
          <p className="text-center py-12 text-[13px] text-[#676B63]">Sin resultados para “{q}”.</p>
        ) : (
          <>
            {/* Tarjetas (celular) */}
            <div className="md:hidden divide-y divide-[#F6F3EC]">
              {visibles.map((p) => (
                <div key={p.id} className="p-4">
                  <div className="flex gap-3">
                    <Miniatura url={portadas[p.id]} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-mono text-[#8A6529]">{p.codigo}</p>
                      <p className="text-[14px] font-semibold text-[#1F2421] truncate">{p.titulo}</p>
                      <p className="text-[12px] text-[#676B63] truncate">{p.tipo}{p.ciudad ? ` · ${p.ciudad}` : ""} · {p.operacion}</p>
                      <p className="text-[14px] font-bold text-[#1F2421] mt-0.5">{precioTxt(p)}</p>
                    </div>
                    <span className={cn("self-start text-[10px] font-semibold px-2 py-0.5 rounded-full", ESTADO_STYLE[p.estado])}>{p.estado}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <BotonWeb p={p} onClick={() => void toggleWeb(p)} />
                    <Acciones p={p} onEditar={() => void abrir(p)} onEstado={cambiarEstado} onEliminar={() => void eliminar(p)} />
                  </div>
                </div>
              ))}
            </div>

            {/* Tabla (pantallas grandes) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="border-b border-[#E9E4D8]">
                    {["", "Código", "Propiedad", "Operación", "Precio", "Estado", "Web", "Acciones"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#676B63] uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((p) => (
                    <tr key={p.id} className="border-b border-[#F6F3EC] hover:bg-[#F6EEDD] transition-colors">
                      <td className="pl-4 py-2"><Miniatura url={portadas[p.id]} /></td>
                      <td className="px-4 py-3 text-[12px] font-mono text-[#8A6529]">{p.codigo}</td>
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-semibold text-[#1F2421]">{p.titulo}</p>
                        <p className="text-[11px] text-[#676B63]">{p.tipo}{p.ciudad ? ` · ${p.ciudad}` : ""}</p>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#565B56]">{p.operacion}</td>
                      <td className="px-4 py-3 text-[13px] font-bold text-[#1F2421]">{precioTxt(p)}</td>
                      <td className="px-4 py-3"><span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", ESTADO_STYLE[p.estado])}>{p.estado}</span></td>
                      <td className="px-4 py-3"><BotonWeb p={p} onClick={() => void toggleWeb(p)} /></td>
                      <td className="px-4 py-3"><div className="flex items-center gap-1"><Acciones p={p} onEditar={() => void abrir(p)} onEstado={cambiarEstado} onEliminar={() => void eliminar(p)} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ---------------------------------- Modal ---------------------------------- */}
      {modal && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label={modal.editar ? "Editar propiedad" : "Cargar propiedad"}>
          <div className="absolute inset-0 bg-black/45" onClick={cerrar} />
          <div className="relative bg-white rounded-t-[22px] sm:rounded-[18px] shadow-modal w-full sm:max-w-2xl max-h-[94dvh] flex flex-col">
            <div className="flex items-center justify-between px-5 sm:px-6 pt-5 pb-3 border-b border-[#F6F3EC]">
              <h2 className="text-[18px] font-bold text-[#1F2421]">{modal.editar ? `Editar ${modal.editar.codigo}` : "Cargar propiedad"}</h2>
              <button onClick={cerrar} aria-label="Cerrar" className="grid place-items-center w-9 h-9 -mr-2 rounded-full text-[#676B63] hover:bg-[#F6F3EC]"><X size={18} /></button>
            </div>

            <div className="overflow-y-auto px-5 sm:px-6 py-4 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2"><label className={label}>Título del aviso *</label>
                  <input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} className={input} placeholder="Ej: Casa 3 dormitorios con jardín en Dorrego" /></div>
                <div><label className={label}>Código {modal.editar ? "" : "(opcional)"}</label>
                  <input value={form.codigo} onChange={(e) => set("codigo", e.target.value)} className={input} placeholder="Se genera solo (MG-0001…)" />
                  <p className="text-[11px] text-[#676B63] mt-1">Podés escribirlo con espacios: se guarda en mayúsculas y con guiones.{form.codigo.trim() && normalizarCodigo(form.codigo) ? <> Quedará: <span className="font-mono font-semibold text-[#8A6529]">{normalizarCodigo(form.codigo)}</span></> : null}</p></div>
                <div><label className={label}>Propietario</label>
                  <select value={form.propietario_id} onChange={(e) => set("propietario_id", e.target.value)} className={input}>
                    <option value="">Sin asignar</option>
                    {propietarios.map((pr) => <option key={pr.id} value={pr.id}>{pr.apellido}, {pr.nombre}</option>)}
                  </select></div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div><label className={label}>Tipo</label><select value={form.tipo} onChange={(e) => set("tipo", e.target.value as Tipo)} className={input}>{TIPOS.map((t) => <option key={t}>{t}</option>)}</select></div>
                <div><label className={label}>Operación</label><select value={form.operacion} onChange={(e) => set("operacion", e.target.value as Fila["operacion"])} className={input}><option>Venta</option><option>Alquiler</option></select></div>
                <div><label className={label}>Moneda</label><select value={form.moneda} onChange={(e) => set("moneda", e.target.value as Fila["moneda"])} className={input}><option>USD</option><option>ARS</option></select></div>
                <div><label className={label}>Precio</label><input type="number" inputMode="decimal" min="0" value={form.precio} onChange={(e) => set("precio", e.target.value)} className={input} placeholder="0" /></div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-3"><label className={label}>Dirección (calle y número)</label><input value={form.direccion} onChange={(e) => set("direccion", e.target.value)} className={input} placeholder="Ej: Dorrego 145" /></div>
                <div><label className={label}>Barrio</label><input value={form.barrio} onChange={(e) => set("barrio", e.target.value)} className={input} placeholder="Ej: Centro" /></div>
                <div><label className={label}>Ciudad</label><input value={form.ciudad} onChange={(e) => set("ciudad", e.target.value)} className={input} placeholder="Ej: San Martín" /></div>
                <div><label className={label}>Estado</label><select value={form.estado} onChange={(e) => set("estado", e.target.value as Estado)} className={input}>{ESTADOS.map((s) => <option key={s}>{s}</option>)}</select></div>
              </div>

              {(form.direccion || form.barrio || form.ciudad) && (
                <div className="overflow-hidden rounded-[10px] border border-[#E9E4D8]">
                  <iframe title="Vista previa del mapa" src={mapaEmbedUrl([form.direccion, form.barrio, form.ciudad || "San Martín, Mendoza"].filter(Boolean).join(", "))}
                    loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="w-full h-[180px] block" />
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {([["ambientes", "Ambientes"], ["dormitorios", "Dormitorios"], ["banos", "Baños"], ["cocheras", "Cocheras"], ["m2_cubiertos", "M² cubiertos"], ["m2_totales", "M² terreno"], ["antiguedad", "Antigüedad (años)"], ["expensas", "Expensas ($/mes)"]] as const).map(([k, l]) => (
                  <div key={k}><label className={label}>{l}</label><input type="number" inputMode="decimal" min="0" value={form[k]} onChange={(e) => set(k, e.target.value)} className={input} /></div>
                ))}
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className={cn(label, "mb-0")}>Descripción</label>
                  <button type="button" onClick={generarDescripcion} disabled={generandoIA}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-semibold bg-[#16201B] text-[#D9BC85] hover:bg-[#1F2D26] disabled:opacity-60">
                    {generandoIA ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}{generandoIA ? "Generando…" : "Generar con IA"}
                  </button>
                </div>
                <textarea value={form.descripcion} onChange={(e) => set("descripcion", e.target.value)} rows={4} maxLength={3000}
                  className="w-full border border-[#E9E4D8] rounded-[9px] px-3 py-2.5 text-[16px] sm:text-[13px] outline-none focus:border-[#8A6529] focus:ring-4 focus:ring-[#8A6529]/15 resize-y"
                  placeholder="Contá lo que hace especial a esta propiedad: distribución, estado, entorno…" /></div>

              <div>
                <p className={label}>Comodidades</p>
                <div className="flex flex-wrap gap-1.5">
                  {[...COMODIDADES, ...comodidades.filter((c) => !COMODIDADES.includes(c))].map((c) => (
                    <button key={c} type="button" onClick={() => toggleComodidad(c)} aria-pressed={comodidades.includes(c)}
                      className={cn("px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors", comodidades.includes(c) ? "bg-[#16201B] text-[#D9BC85] border-[#16201B]" : "bg-white text-[#565B56] border-[#E9E4D8] hover:border-[#8A6529]")}>{c}</button>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <input value={otra} onChange={(e) => setOtra(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarOtra(); } }} className={input} placeholder="Otra comodidad…" maxLength={40} />
                  <button type="button" onClick={agregarOtra} className="px-4 rounded-[9px] border border-[#E9E4D8] text-[13px] font-semibold text-[#565B56] hover:border-[#8A6529]">Agregar</button>
                </div>
              </div>

              {/* Fotos */}
              <div className="border-t border-[#E9E4D8] pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className={cn(label, "mb-0")}>Fotos ({items.length}/{MAX_FOTOS})</p>
                  {items.length > 0 && items.length < MAX_FOTOS && (
                    <button type="button" onClick={() => fileRef.current?.click()} className="text-[12px] font-semibold text-[#8A6529] hover:underline">+ Agregar más</button>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => agregarFotos(e.target.files)} />
                {items.length === 0 ? (
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="w-full h-28 border-2 border-dashed border-[#E9E4D8] rounded-[12px] flex flex-col items-center justify-center gap-1 hover:border-[#8A6529] hover:bg-[#F6EEDD] transition-colors">
                    <ImagePlus size={22} className="text-[#A3A69C]" />
                    <span className="text-[12px] text-[#676B63]">Tocá para elegir fotos (se optimizan solas)</span>
                  </button>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {items.map((it, i) => (
                      <div key={it.k} className="relative aspect-square rounded-[8px] overflow-hidden bg-[#F6F3EC]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={it.url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                        {i === 0 && <span className="absolute bottom-1 left-1 bg-[#8A6529] text-white text-[9px] font-bold px-1.5 py-0.5 rounded">PRINCIPAL</span>}
                        <button type="button" onClick={() => quitarFoto(it.k)} aria-label="Quitar foto" className="absolute top-1 right-1 grid place-items-center w-7 h-7 text-white bg-black/60 rounded-full hover:bg-black/80"><X size={14} /></button>
                        {i !== 0 && <button type="button" onClick={() => hacerPrincipal(it.k)} aria-label="Hacer principal" title="Hacer principal" className="absolute bottom-1 right-1 grid place-items-center w-7 h-7 text-white bg-black/60 rounded-full hover:bg-[#8A6529]"><Star size={13} /></button>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-4 py-3 border-t border-[#E9E4D8]">
                <div>
                  <p className="text-[13px] font-semibold text-[#1F2421]">Publicar en el sitio web</p>
                  <p className="text-[11px] text-[#676B63]">{form.estado === "Activa" ? "Visible en el catálogo público" : "Solo las propiedades Activas se publican"}</p>
                </div>
                <button type="button" role="switch" aria-checked={form.publicada_web && form.estado === "Activa"} disabled={form.estado !== "Activa"}
                  onClick={() => set("publicada_web", !form.publicada_web)}
                  className={cn("w-12 h-7 shrink-0 rounded-full transition-colors relative disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8A6529]/25", form.publicada_web && form.estado === "Activa" ? "bg-[#8A6529]" : "bg-[#E9E4D8]")}>
                  <span className={cn("absolute left-0 top-1 w-5 h-5 bg-white rounded-full shadow transition-transform", form.publicada_web && form.estado === "Activa" ? "translate-x-6" : "translate-x-1")} />
                </button>
              </div>
            </div>

            <div className="flex gap-3 px-5 sm:px-6 py-4 border-t border-[#F6F3EC] pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button onClick={cerrar} className="flex-1 h-11 border border-[#E9E4D8] rounded-[10px] text-[14px] font-semibold text-[#565B56] hover:bg-[#F6F3EC]">Cancelar</button>
              <button onClick={() => void guardar()} disabled={saving}
                className="flex-1 h-11 bg-[#8A6529] text-white rounded-[10px] text-[14px] font-semibold hover:bg-[#6E4F1F] disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && <Loader2 size={15} className="animate-spin" />}
                {saving ? (subiendo ? `Subiendo foto ${subiendo.actual}/${subiendo.total}…` : "Guardando…") : modal.editar ? "Guardar cambios" : "Guardar propiedad"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Piezas --------------------------------- */
function Miniatura({ url }: { url?: string }) {
  return (
    <div className="relative w-14 h-14 shrink-0 rounded-[10px] overflow-hidden bg-[#F6EEDD] grid place-items-center text-[#8A6529]/50">
      {url ? <Image src={url} alt="" fill sizes="56px" className="object-cover" /> : <Home size={20} />}
    </div>
  );
}

function BotonWeb({ p, onClick }: { p: Fila; onClick: () => void }) {
  const esTitular = useEsTitular();
  const cls = cn("flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-full",
    p.publicada_web ? "bg-[#EAF7F0] text-[#1F9D5B]" : "bg-[#F6F3EC] text-[#676B63]");
  const contenido = p.publicada_web ? <><Globe size={11} /> Publicada</> : <><EyeOff size={11} /> No publicada</>;
  if (!esTitular) return <span className={cls}>{contenido}</span>;
  return (
    <button onClick={onClick} title={p.publicada_web ? "Quitar del sitio web" : "Publicar en el sitio web"}
      className={cn(cls, "transition-colors", p.publicada_web ? "hover:bg-[#FBECEF] hover:text-[#C0506A]" : "hover:bg-[#EAF7F0] hover:text-[#1F9D5B]")}>
      {contenido}
    </button>
  );
}

function Acciones({ p, onEditar, onEstado, onEliminar }: { p: Fila; onEditar: () => void; onEstado: (p: Fila, e: Estado) => void; onEliminar: () => void }) {
  const esTitular = useEsTitular();
  const btn = "p-2 rounded-[6px] text-[#676B63] hover:bg-[#F6F3EC]";
  const verEnSitio = p.publicada_web && p.estado === "Activa" && (
    <a href={rutaPropiedad(p.codigo)} target="_blank" rel="noopener noreferrer" className={btn} title="Ver en el sitio" aria-label={`Ver ${p.codigo} en el sitio`}><ExternalLink size={14} /></a>
  );
  const copiarResumen = async () => {
    const dato = (n: number | null, t: string) => (n ? `${n} ${t}` : "");
    const lineas = [
      `🏡 *${p.titulo}* (${p.codigo})`,
      `💰 ${formatPrecio(p.precio, p.moneda, p.operacion === "Alquiler" ? "alquiler" : "venta")}`,
      `📍 ${[p.barrio, p.ciudad].filter(Boolean).join(", ") || "Mendoza"}`,
      [dato(p.dormitorios, "dorm."), dato(p.banos, "baños"), p.m2_cubiertos ? `${p.m2_cubiertos} m² cubiertos` : "", p.m2_totales ? `${p.m2_totales} m² totales` : ""].filter(Boolean).join(" · "),
      "",
      `Ver fotos y detalles: ${window.location.origin}${rutaPropiedad(p.codigo)}`,
    ].filter((l, i, a) => l !== "" || (i > 0 && a[i - 1] !== ""));
    try { await navigator.clipboard.writeText(lineas.join("\n")); toast.success("Resumen copiado: pegalo en WhatsApp"); }
    catch { toast.error("No se pudo copiar. Probá desde un navegador actualizado."); }
  };
  const compartir = p.publicada_web && p.estado === "Activa" && (
    <button onClick={copiarResumen} className={btn} title="Copiar resumen para WhatsApp" aria-label={`Copiar resumen de ${p.codigo}`}><Share2 size={14} /></button>
  );
  if (!esTitular) return <>{compartir}{verEnSitio}</>;
  return (
    <>
      <button onClick={onEditar} className={btn} title="Editar" aria-label={`Editar ${p.codigo}`}><Pencil size={14} /></button>
      {compartir}
      {verEnSitio}
      {p.estado === "Activa" && (
        <button onClick={() => onEstado(p, p.operacion === "Venta" ? "Vendida" : "Alquilada")}
          className="text-[11px] font-semibold px-2.5 py-1.5 bg-[#EAF0FB] text-[#3B82C4] rounded-[6px] hover:bg-[#3B82C4] hover:text-white transition-colors whitespace-nowrap">
          {p.operacion === "Venta" ? "Vendida" : "Alquilada"}
        </button>
      )}
      {(p.estado === "Vendida" || p.estado === "Alquilada" || p.estado === "Reservada") && (
        <button onClick={() => onEstado(p, "Activa")} className={btn} title="Reactivar" aria-label={`Reactivar ${p.codigo}`}><RotateCcw size={14} /></button>
      )}
      <button onClick={onEliminar} className="p-2 rounded-[6px] text-[#C0506A] hover:bg-[#FBECEF]" title="Eliminar" aria-label={`Eliminar ${p.codigo}`}><Trash2 size={14} /></button>
    </>
  );
}
