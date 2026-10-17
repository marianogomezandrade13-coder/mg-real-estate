import type { Metadata } from "next";

// Área privada del equipo: fuera de buscadores.
export const metadata: Metadata = {
  title: "Panel interno",
  robots: { index: false, follow: false },
};

export default function PanelRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
