import type { Metadata } from "next";
import { CatalogoClient } from "./CatalogoClient";
import { listarPublicadas } from "@/lib/propiedades-db";

export const metadata: Metadata = {
  title: "Catálogo de propiedades",
  description: "Casas, departamentos, lotes y fincas en venta y alquiler en San Martín y toda Mendoza.",
};

// Se regenera cada 60 s y al instante cuando el panel publica o cambia una propiedad.
export const revalidate = 60;

export default async function CatalogoPage() {
  return <CatalogoClient propiedades={await listarPublicadas()} />;
}
