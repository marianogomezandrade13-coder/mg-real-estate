import { LogOut } from "lucide-react";
import { PanelLayout } from "@/components/panel/PanelLayout";
import { requireStaff } from "@/lib/auth";
import { salirStaff } from "@/lib/auth-actions";

/** Verificación real (servidor): sin sesión de equipo activa nunca se renderiza el panel. */
export default async function Layout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  return (
    <PanelLayout
      user={{ nombre: staff.nombre, rol: staff.rol }}
      logoutSlot={
        <form action={salirStaff}>
          <button type="submit" aria-label="Cerrar sesión" title="Cerrar sesión"
            className="grid place-items-center w-9 h-9 rounded-[9px] text-[#A3A69C] hover:text-white hover:bg-white/10 transition-colors">
            <LogOut size={16} />
          </button>
        </form>
      }
    >
      {children}
    </PanelLayout>
  );
}
