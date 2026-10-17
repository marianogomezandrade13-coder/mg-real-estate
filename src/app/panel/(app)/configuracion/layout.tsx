import { requireStaff } from "@/lib/auth";

// Configuración: solo la titular (el contable no la ve ni entrando por URL).
export default async function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  await requireStaff(["titular"]);
  return children;
}
