import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/panel/PageHeader";
import { ConfiguracionClient, type UsuarioStaff, type EntradaAuditoria } from "./ConfiguracionClient";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const staff = await requireStaff(["titular"]);
  const supabase = await createClient();
  const [u, c, a] = await Promise.all([
    supabase.from("usuarios").select("id,nombre,email,rol,activo").order("nombre"),
    supabase.from("comisiones").select("admin_alquiler_pct,venta_pct,tasacion_pct").is("sucursal_id", null).limit(1).maybeSingle(),
    supabase.from("auditoria").select("id,accion,entidad,usuario_id,fecha").order("fecha", { ascending: false }).limit(10),
  ]);

  const usuarios: UsuarioStaff[] = (u.data ?? []).map((x) => ({ id: x.id, nombre: x.nombre, email: x.email, rol: x.rol as "titular" | "contable", activo: x.activo }));
  const nombrePorId = new Map(usuarios.map((x) => [x.id, x.nombre]));
  const actividad: EntradaAuditoria[] = (a.data ?? []).map((x) => ({
    id: x.id, accion: x.accion, entidad: x.entidad, fecha: x.fecha, usuario: (x.usuario_id && nombrePorId.get(x.usuario_id)) || "Sistema",
  }));

  return (
    <div className="p-4 sm:p-7">
      <PageHeader title="Configuración" subtitle="Usuarios, comisiones y actividad" />
      <ConfiguracionClient
        usuarios={usuarios} miUsuarioId={staff.id}
        comisiones={c.data ?? { admin_alquiler_pct: 10, venta_pct: 6, tasacion_pct: 1 }}
        actividad={actividad} loadError={u.error?.message ?? null}
      />
    </div>
  );
}
