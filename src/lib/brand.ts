/**
 * Fuente única de datos de marca. Cambiar acá se refleja en sitio, panel y portal.
 * Datos de contacto confirmados por Mariano Gómez (2026-09-23). Matrícula CPI: todavía en trámite.
 */
export const BRAND = {
  name: "MG Real Estate",
  short: "MG",
  tagline: "Propiedades con carácter, en el corazón de Mendoza.",
  city: "San Martín, Mendoza",
  address: "Pasaje del Portillo 243, San Martín, Mendoza",
  phoneDisplay: "+54 9 2634 77-9737",
  whatsapp: "5492634779737",
  email: "mariano.gomezandrade13@gmail.com",
  hours: "Lunes a viernes 9 a 18 hs · Sábados 9 a 13 hs",
  // Sin matrícula CPI todavía (en trámite): no se muestra como si existiera.
  matricula: "Matrícula CPI en trámite",
  titular: { nombre: "Mariano Gómez", iniciales: "MG", rol: "Titular de MG Real Estate" },
  // Cifras del inicio (operaciones, años, sucursales): cargar SOLO cuando MG las confirme. Vacío = la sección no se muestra.
  stats: [] as { valor: number; prefijo: string; label: string }[],
} as const;

export function waLink(text: string) {
  return `https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(text)}`;
}
