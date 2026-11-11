import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, MessageCircle } from "lucide-react";
import { BRAND, waLink } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Preguntas frecuentes",
  description: "Cómo coordinar una visita, publicar tu propiedad, pedir una tasación y acceder al portal de clientes de MG Real Estate.",
  alternates: { canonical: "/preguntas-frecuentes" },
};

const PREGUNTAS: { q: string; a: string }[] = [
  { q: "¿Cómo coordino una visita a una propiedad?", a: "Entrá a la ficha de la propiedad y tocá “Agendar visita” o “Consultar por WhatsApp”. También podés escribirnos desde la página de contacto. Te respondemos en menos de 24 horas hábiles para acordar día y horario." },
  { q: "¿Por qué la ficha no muestra la dirección exacta?", a: "Mostramos la zona de la propiedad. La dirección exacta se informa al coordinar la visita." },
  { q: "¿Cómo publico mi propiedad con MG Real Estate?", a: "Escribinos por WhatsApp o desde la página de contacto con el asunto “Quiero vender” o “Quiero alquilar”. Nuestro equipo releva la propiedad, la carga con fotos y datos reales y la publica en la web." },
  { q: "¿Cómo pido una tasación?", a: "Desde la página de contacto, en la sección de tasaciones, o por WhatsApp. Relevamos el inmueble, analizamos el mercado de la zona y te entregamos un informe." },
  { q: "¿Qué puedo hacer en el portal de clientes?", a: "Propietarios e inquilinos pueden ingresar al portal para ver su información, sus documentos y el estado de sus pagos y liquidaciones. El acceso se habilita desde la inmobiliaria." },
  { q: "¿Puedo guardar propiedades para ver después?", a: "Sí. Tocá el corazón en cualquier propiedad y la vas a encontrar en “Favoritos”, en el menú. Se guardan en tu propio dispositivo." },
  { q: "¿Cómo me entero cuando hay propiedades nuevas?", a: "Si no encontrás lo que buscás, usá “Avisarme cuando haya algo así” en el catálogo o escribinos contando qué necesitás, y te avisamos cuando aparezca." },
  { q: "¿Dónde están y cuál es el horario de atención?", a: `Estamos en ${BRAND.address}. Atendemos ${BRAND.hours.toLowerCase().replace(/^l/, "L")}.` },
];

export default function PreguntasFrecuentesPage() {
  const jsonLd = {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: PREGUNTAS.map((p) => ({ "@type": "Question", name: p.q, acceptedAnswer: { "@type": "Answer", text: p.a } })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\u003c") }} />
      <section className="bg-forest border-b border-gold-light/10">
        <div className="max-w-7xl mx-auto px-6 pt-10 pb-12">
          <nav aria-label="Migas de pan" className="text-[12px] text-white/50 flex items-center gap-1.5 mb-5">
            <Link href="/" className="hover:text-gold-light transition-colors">Inicio</Link><ChevronRight size={12} />
            <span className="text-white/80 font-semibold">Preguntas frecuentes</span>
          </nav>
          <h1 className="font-display text-white text-[40px] md:text-[56px] font-medium leading-none">Preguntas <span className="text-gold-gradient italic">frecuentes</span></h1>
        </div>
      </section>
      <div className="bg-app-bg">
        <div className="max-w-3xl mx-auto px-6 py-14 space-y-3">
          {PREGUNTAS.map((p) => (
            <details key={p.q} className="group bg-white rounded-[16px] border border-border-light px-6 py-4 open:shadow-card">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4 text-[16px] font-semibold text-text-primary">
                {p.q}<ChevronRight size={16} className="shrink-0 text-gold transition-transform group-open:rotate-90" />
              </summary>
              <p className="mt-3 text-[14px] text-text-secondary leading-[1.7]">{p.a}</p>
            </details>
          ))}
          <div className="pt-6 text-center">
            <p className="text-[14px] text-text-muted mb-4">¿No encontraste tu respuesta?</p>
            <a href={waLink("Hola, tengo una consulta.")} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-whatsapp text-forest font-bold text-[14px] px-6 py-3 rounded-[12px]"><MessageCircle size={16} />Escribinos por WhatsApp</a>
          </div>
        </div>
      </div>
    </>
  );
}
