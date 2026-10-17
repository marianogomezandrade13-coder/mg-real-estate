"use client";

import Link from "next/link";
import { MapPin, Phone, Mail, Clock, ChevronRight, ArrowRight, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { BRAND, waLink } from "@/lib/brand";
import { mapaEmbedUrl } from "@/lib/propiedades";

const ASUNTOS = ["Consulta por propiedad", "Quiero alquilar", "Quiero vender", "Tasación", "Otro"];
const inputCls =
  "w-full h-12 bg-app-bg-tint border border-border-mid rounded-[11px] px-4 text-[16px] sm:text-[14px] outline-none focus:border-gold focus:ring-4 focus:ring-gold/15 transition-all";
const labelCls = "block text-[12px] font-semibold tracking-wide text-text-secondary mb-1.5";

export function ContactoClient() {
  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const msg = `Hola, soy ${f.get("nombre")}. Asunto: ${f.get("asunto")}. ${f.get("mensaje") || ""} Mi contacto: ${f.get("telefono") || f.get("email") || "-"}`.trim();
    window.open(waLink(msg), "_blank", "noopener,noreferrer");
    toast.success("Te llevamos a WhatsApp para completar tu consulta");
  };

  const datos = [
    { Icon: MapPin, titulo: "Casa central", lineas: [BRAND.address] },
    { Icon: Phone, titulo: "Teléfono y WhatsApp", lineas: [BRAND.phoneDisplay] },
    { Icon: Mail, titulo: "Email", lineas: [BRAND.email] },
    { Icon: Clock, titulo: "Horario de atención", lineas: [BRAND.hours] },
  ];

  return (
    <>
      <section className="bg-forest border-b border-gold-light/10">
        <div className="max-w-7xl mx-auto px-6 pt-10 pb-12">
          <nav aria-label="Migas de pan" className="text-[12px] text-white/50 flex items-center gap-1.5 mb-5">
            <Link href="/" className="hover:text-gold-light transition-colors">Inicio</Link>
            <ChevronRight size={12} />
            <span className="text-white/80 font-semibold">Contacto</span>
          </nav>
          <p className="text-gold-light text-[11px] font-bold tracking-[0.28em] uppercase mb-3 flex items-center gap-3">
            <span className="h-px w-8 bg-gold-light/60" />Contacto
          </p>
          <h1 className="font-display text-white text-[40px] md:text-[56px] font-medium leading-none">
            Hablemos de <span className="text-gold-gradient italic">tu propiedad</span>
          </h1>
          <p className="text-white/60 mt-4 max-w-lg">Respondemos en menos de 24 horas hábiles.</p>
        </div>
      </section>

      <div className="bg-app-bg">
        <div className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          {/* Formulario */}
          <div className="bg-white rounded-[24px] border border-border-light p-8 shadow-card">
            <h2 className="font-display text-[28px] font-medium text-forest mb-6">Envianos un mensaje</h2>
            <form className="space-y-5" onSubmit={enviar}>
              {[
                { name: "nombre", label: "Nombre completo", type: "text", req: true },
                { name: "email", label: "Email", type: "email", req: false },
                { name: "telefono", label: "Teléfono", type: "tel", req: false },
              ].map(({ name, label, type, req }) => (
                <div key={name}>
                  <label htmlFor={`k-${name}`} className={labelCls}>{label}</label>
                  <input id={`k-${name}`} name={name} type={type} required={req} className={inputCls} />
                </div>
              ))}
              <div>
                <label htmlFor="k-asunto" className={labelCls}>Asunto</label>
                <select id="k-asunto" name="asunto" className={inputCls}>
                  {ASUNTOS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="k-mensaje" className={labelCls}>Mensaje</label>
                <textarea id="k-mensaje" name="mensaje" rows={4}
                  className="w-full bg-app-bg-tint border border-border-mid rounded-[11px] px-4 py-3 text-[16px] sm:text-[14px] outline-none focus:border-gold focus:ring-4 focus:ring-gold/15 transition-all resize-none" />
              </div>
              <button type="submit"
                className="group w-full py-3.5 bg-forest hover:bg-forest-3 text-gold-light font-bold text-[15px] rounded-[12px] transition-colors flex items-center justify-center gap-2">
                Enviar consulta <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </button>
            </form>
          </div>

          <div className="space-y-6">
            {/* Datos */}
            <div className="bg-white rounded-[24px] border border-border-light p-8 shadow-card">
              <h2 className="font-display text-[28px] font-medium text-forest mb-6">Información de contacto</h2>
              <ul className="space-y-5">
                {datos.map(({ Icon, titulo, lineas }) => (
                  <li key={titulo} className="flex items-start gap-4">
                    <span className="grid place-items-center w-10 h-10 rounded-full bg-gold-bg text-gold shrink-0"><Icon size={17} /></span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-text-primary">{titulo}</p>
                      {lineas.map((l) => <p key={l} className="text-[14px] text-text-secondary break-words">{l}</p>)}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-6 overflow-hidden rounded-[16px] border border-border-light">
                <iframe title={`Mapa de la oficina: ${BRAND.address}`} src={mapaEmbedUrl(BRAND.address)} loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade" className="w-full h-[220px] block" />
              </div>
            </div>

            {/* Tasación */}
            <div id="tasacion" className="relative overflow-hidden bg-forest rounded-[24px] p-8 scroll-mt-24">
              <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-gold-light/10 blur-2xl" aria-hidden />
              <p className="relative text-gold-light text-[11px] font-bold tracking-[0.28em] uppercase mb-3">Tasaciones profesionales</p>
              <h2 className="relative font-display text-white text-[28px] font-medium leading-tight mb-3">
                ¿Cuánto vale <span className="italic text-gold-gradient">realmente</span> tu propiedad?
              </h2>
              <p className="relative text-white/65 text-[14px] mb-6 leading-relaxed">
                Nuestros tasadores relevan tu inmueble, analizan el mercado de la zona y te entregan un informe profesional con valor mínimo, recomendado y óptimo.
              </p>
              <a href={waLink("Hola, quiero solicitar la tasación profesional de mi propiedad.")} target="_blank" rel="noopener noreferrer"
                className="relative inline-flex items-center gap-2 bg-gold-light hover:bg-champagne text-forest font-bold text-[14px] px-6 py-3 rounded-[12px] transition-colors">
                <MessageCircle size={16} />Solicitar tasación por WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
