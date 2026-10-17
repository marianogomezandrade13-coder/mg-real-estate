import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { requireCliente } from "@/lib/auth";
import { salirCliente } from "@/lib/auth-actions";
import { datosPropietario } from "@/lib/portal-data";
import { PropietarioView } from "@/components/portal/PropietarioView";

export const dynamic = "force-dynamic";

export default async function PortalPropietarioPage() {
  const cliente = await requireCliente("propietario"); // un inquilino que llegue acá es redirigido a lo suyo
  if (cliente.debeCambiarClave) redirect("/portal/clave");
  const data = await datosPropietario(cliente.id);

  return (
    <PropietarioView
      nombre={`${cliente.nombre} ${cliente.apellido}`}
      data={data}
      logoutSlot={
        <form action={salirCliente}>
          <button type="submit" className="flex items-center gap-1.5 text-[12px] font-semibold text-[#A3A69C] hover:text-white border border-white/20 px-3 py-2 rounded-[8px] transition-colors min-h-[36px]">
            <LogOut size={13} /><span className="hidden sm:inline">Salir</span><span className="sr-only sm:hidden">Salir</span>
          </button>
        </form>
      }
    />
  );
}
