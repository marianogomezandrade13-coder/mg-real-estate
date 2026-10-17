import type { Database } from "@/types/database";

export type Lead = Database["public"]["Tables"]["leads"]["Row"];
export type LeadActividad = Database["public"]["Tables"]["lead_actividades"]["Row"];
export type Etapa = Lead["etapa"];
export type Origen = Lead["origen"];
export type TipoActividad = LeadActividad["tipo"];

export const ETAPAS: { id: Etapa; label: string; color: string }[] = [
  { id: "nuevo", label: "Nuevo lead", color: "#676B63" },
  { id: "contactado", label: "Contactado", color: "#3B82C4" },
  { id: "visita", label: "Visita programada", color: "#E0A93B" },
  { id: "negociacion", label: "Negociación", color: "#8A6529" },
  { id: "reserva", label: "Reserva", color: "#6E4F1F" },
  { id: "cerrada", label: "Cerrada", color: "#1F9D5B" },
];

export const ORIGENES: Origen[] = ["WhatsApp", "Web", "Instagram", "ZonaProp", "Argenprop", "Mercado Libre", "Referido"];
export const ORIGEN_COLORS: Record<Origen, string> = {
  WhatsApp: "#25D366", Web: "#3B82C4", Instagram: "#E0A93B",
  ZonaProp: "#8A6529", Argenprop: "#6E4F1F", Referido: "#1F9D5B", "Mercado Libre": "#E0A93B",
};

export const ACTIVIDADES: { id: TipoActividad; label: string }[] = [
  { id: "llamada", label: "Llamada" }, { id: "email", label: "Email" }, { id: "whatsapp", label: "WhatsApp" },
  { id: "reunion", label: "Reunión" }, { id: "visita", label: "Visita" }, { id: "nota", label: "Nota" },
];

export const etapaDe = (id: Etapa) => ETAPAS.find((e) => e.id === id) ?? ETAPAS[0];

/** "hace 5 min" / "hace 3h" / "hace 2d" / fecha para más de una semana. */
export function relativo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d}d`;
  const dt = new Date(iso);
  return dt.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}
