import { HomeClient } from "./HomeClient";
import { listarPublicadas } from "@/lib/propiedades-db";
import { BRAND } from "@/lib/brand";

// Se regenera cada 60 s y al instante cuando el panel publica o cambia una propiedad.
export const revalidate = 60;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mgrealestate.vercel.app";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "RealEstateAgent",
  name: BRAND.name,
  description: BRAND.tagline,
  url: SITE_URL,
  image: `${SITE_URL}/hero-loteo.jpeg`,
  telephone: `+${BRAND.whatsapp}`,
  email: BRAND.email,
  address: { "@type": "PostalAddress", streetAddress: "Pasaje del Portillo 243", addressLocality: "San Martín", addressRegion: "Mendoza", addressCountry: "AR" },
  areaServed: "Mendoza, Argentina",
  openingHoursSpecification: [
    { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "09:00", closes: "18:00" },
    { "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "09:00", closes: "13:00" },
  ],
};

export default async function HomePage() {
  const propiedades = await listarPublicadas();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <HomeClient destacadas={propiedades.slice(0, 6)} />
    </>
  );
}
