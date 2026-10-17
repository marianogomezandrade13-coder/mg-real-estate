import type { Metadata } from "next";
import { FavoritosClient } from "./FavoritosClient";
import { listarPublicadas } from "@/lib/propiedades-db";

export const metadata: Metadata = {
  title: "Favoritos",
  description: "Las propiedades que guardaste para comparar más tarde.",
  robots: { index: false, follow: true },
};

export const revalidate = 60;

export default async function FavoritosPage() {
  return <FavoritosClient propiedades={await listarPublicadas()} />;
}
