"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";

/** El panel la llama al publicar/editar/borrar una propiedad: la web pública se actualiza al instante (sin esperar 60 s). */
export async function revalidarSitioPublico() {
  await requireStaff();
  revalidatePath("/");
  revalidatePath("/catalogo");
  revalidatePath("/propiedad/[code]", "page");
  revalidatePath("/sitemap.xml");
}
