"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export type ConsultaWeb = {
  nombre: string; email: string; telefono: string; asunto: string; mensaje: string;
  /** Campo trampa para bots: las personas lo dejan vacío. */
  web?: string;
};

const ASUNTOS = ["Consulta por propiedad", "Quiero alquilar", "Quiero vender", "Tasación", "Otro", "Aviso de propiedades nuevas"];

/**
 * Guarda una consulta del sitio público como cliente + lead (origen "Web") para que aparezca en el CRM del panel.
 * Es pública (la usan visitantes sin sesión), por eso valida todo, limita largos y usa un campo trampa anti-bots.
 */
export async function registrarConsultaWeb(c: ConsultaWeb): Promise<{ ok: true } | { ok: false; error: string }> {
  if (c.web) return { ok: true }; // bot: fingimos éxito sin guardar nada

  const nombre = c.nombre.trim().replace(/\s+/g, " ").slice(0, 80);
  const email = c.email.trim().toLowerCase().slice(0, 120);
  const telefono = c.telefono.trim().slice(0, 40);
  const mensaje = c.mensaje.trim().slice(0, 1500);
  const asunto = ASUNTOS.includes(c.asunto) ? c.asunto : "Otro";

  if (nombre.length < 2) return { ok: false, error: "Escribí tu nombre." };
  if (!email && !telefono) return { ok: false, error: "Dejanos un teléfono o un email para poder responderte." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "El email no parece válido." };

  try {
    const db = createAdminClient();
    const { data: suc } = await db.from("sucursales").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle();
    const sucursal_id = suc?.id ?? null;

    // Reusar el contacto si ya escribió antes (mismo email o teléfono)
    let clienteId: string | null = null;
    if (email) {
      const { data } = await db.from("clientes").select("id").eq("email", email).limit(1).maybeSingle();
      clienteId = data?.id ?? null;
    }
    if (!clienteId && telefono) {
      const { data } = await db.from("clientes").select("id").eq("telefono", telefono).limit(1).maybeSingle();
      clienteId = data?.id ?? null;
    }
    if (!clienteId) {
      const [primero, ...resto] = nombre.split(" ");
      const { data, error } = await db.from("clientes").insert({
        sucursal_id, nombre: primero, apellido: resto.join(" ") || "-", telefono: telefono || null, whatsapp: telefono || null,
        email: email || null, tipo: "lead", observaciones: "Creado desde el formulario del sitio web",
      }).select("id").single();
      if (error) throw error;
      clienteId = data.id;
    }

    const { data: lead, error: errLead } = await db.from("leads").insert({
      sucursal_id, cliente_id: clienteId, nombre, interes: `${asunto}${mensaje ? ` — ${mensaje}` : ""}`.slice(0, 600),
      propiedad_id: null, valor_estimado: null, origen: "Web", etapa: "nuevo", asignado_a: null,
    }).select("id").single();
    if (errLead) throw errLead;

    await db.from("lead_actividades").insert({
      lead_id: lead.id, tipo: "nota", fecha: new Date().toISOString(),
      detalle: `Consulta web (${asunto}). Contacto: ${[telefono, email].filter(Boolean).join(" · ")}.${mensaje ? `\n${mensaje}` : ""}`,
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "No pudimos registrar tu consulta. Probá de nuevo o escribinos por WhatsApp." };
  }
}

/**
 * Anota en el CRM que alguien tocó "Consultar por WhatsApp" / "Agendar visita" en una ficha, para saber qué propiedad
 * genera interés (el mensaje en sí llega por WhatsApp). No guarda datos personales. Tope por hora para que un bot no llene el CRM.
 */
export async function registrarInteresPropiedad(codigo: string, via: "consulta" | "visita"): Promise<void> {
  try {
    const cod = String(codigo).slice(0, 60);
    const db = createAdminClient();
    const { data: prop } = await db.from("propiedades").select("id,titulo,codigo").eq("codigo", cod).eq("publicada_web", true).maybeSingle();
    if (!prop) return;
    const desde = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await db.from("leads").select("id", { count: "exact", head: true })
      .eq("propiedad_id", prop.id).eq("origen", "WhatsApp").gte("created_at", desde);
    if ((count ?? 0) >= 8) return;
    const { data: suc } = await db.from("sucursales").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle();
    await db.from("leads").insert({
      sucursal_id: suc?.id ?? null, cliente_id: null, nombre: `Consulta por WhatsApp (${prop.codigo})`,
      interes: `${via === "visita" ? "Quiere agendar visita" : "Consulta"} desde la web: ${prop.titulo}`,
      propiedad_id: prop.id, valor_estimado: null, origen: "WhatsApp", etapa: "nuevo", asignado_a: null,
    });
  } catch { /* es una métrica: nunca debe romper el botón */ }
}
