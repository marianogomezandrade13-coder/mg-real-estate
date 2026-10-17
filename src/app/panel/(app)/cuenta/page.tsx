import { KeyRound } from "lucide-react";
import { PageHeader } from "@/components/panel/PageHeader";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { requireStaff } from "@/lib/auth";

export default async function CuentaPage() {
  const staff = await requireStaff();
  return (
    <div className="p-4 sm:p-7">
      <PageHeader title="Mi cuenta" subtitle={`${staff.nombre} · ${staff.rol}`} />
      <div className="bg-white rounded-[16px] shadow-card p-5 sm:p-7 max-w-[460px]">
        <span className="grid place-items-center w-10 h-10 rounded-full bg-[#F6EEDD] text-[#8A6529] mb-3"><KeyRound size={18} /></span>
        <h2 className="text-[16px] font-bold text-[#1F2421]">Cambiar contraseña</h2>
        <p className="text-[13px] text-[#676B63] mt-1 mb-5">Elegí una contraseña que solo vos conozcas. Al guardar volvés al panel.</p>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
