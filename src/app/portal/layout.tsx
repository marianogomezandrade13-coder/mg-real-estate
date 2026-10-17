import type { Metadata } from "next";

// Área privada: no debe aparecer en buscadores.
export const metadata: Metadata = {
  title: "Portal de clientes",
  robots: { index: false, follow: false },
};

export default function PortalRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
