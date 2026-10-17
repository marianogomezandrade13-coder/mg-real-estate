import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk, Space_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { BRAND } from "@/lib/brand";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mgrealestate.vercel.app";
const DESCRIPCION = `${BRAND.tagline} Compra, venta, alquiler y tasaciones en ${BRAND.city}.`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${BRAND.name} · ${BRAND.city}`, template: `%s · ${BRAND.name}` },
  description: DESCRIPCION,
  openGraph: {
    type: "website", locale: "es_AR", siteName: BRAND.name, title: `${BRAND.name} · ${BRAND.city}`, description: DESCRIPCION,
    images: [{ url: "/hero-loteo.jpeg", alt: "Loteo en San Martín, Mendoza, al atardecer" }],
  },
  twitter: { card: "summary_large_image", title: `${BRAND.name} · ${BRAND.city}`, description: DESCRIPCION, images: ["/hero-loteo.jpeg"] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${plusJakarta.variable} ${spaceGrotesk.variable} ${spaceMono.variable} ${newsreader.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="bottom-center" richColors />
      </body>
    </html>
  );
}
