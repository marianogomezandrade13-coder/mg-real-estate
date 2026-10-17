import { headers } from "next/headers";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/panel/PageHeader";
import { AccesosClient, type ClienteAcceso } from "./AccesosClient";

export const dynamic = "force-dynamic";

export default async function AccesosPage() {
  await requireStaff(["titular"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clientes")
    .select("id,nombre,apellido,tipo,email,telefono,auth_id,acceso_activo")
    .in("tipo", ["propietario", "inquilino"])
    .order("apellido", { ascending: true });

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  const clientes: ClienteAcceso[] = (data ?? []).map((c) => ({
    id: c.id, nombre: c.nombre, apellido: c.apellido, tipo: c.tipo as "propietario" | "inquilino",
    email: c.email, telefono: c.telefono,
    estado: !c.auth_id ? "sin_acceso" : c.acceso_activo ? "activo" : "suspendido",
  }));

  return (
    <div className="p-4 sm:p-7">
      <PageHeader title="Accesos de clientes" subtitle="Creá el usuario y la contraseña de propietarios e inquilinos para el portal" />
      <AccesosClient clientes={clientes} loginUrl={`${proto}://${host}/portal`} loadError={error?.message ?? null} />
    </div>
  );
}
