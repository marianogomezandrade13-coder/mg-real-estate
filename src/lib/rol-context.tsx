"use client";

import { createContext, useContext } from "react";

export type RolStaff = "titular" | "contable";

// Por defecto el más restrictivo: si algo se renderiza fuera del proveedor, no expone acciones de escritura.
const RolContext = createContext<RolStaff>("contable");

export function RolProvider({ rol, children }: { rol: RolStaff; children: React.ReactNode }) {
  return <RolContext.Provider value={rol}>{children}</RolContext.Provider>;
}

/** El contable solo puede escribir en Finanzas, Caja, Liquidaciones y Recibos (así lo aplica también la base vía RLS). */
export function useEsTitular() {
  return useContext(RolContext) === "titular";
}
