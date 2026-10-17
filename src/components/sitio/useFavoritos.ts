"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/* Favoritos persistentes: localStorage expuesto como store externo (sin desajuste de hidratación). */
const KEY = "mg_favs";
const listeners = new Set<() => void>();

const read = () => {
  try { return localStorage.getItem(KEY) || "[]"; } catch { return "[]"; }
};
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => { listeners.delete(cb); window.removeEventListener("storage", cb); };
};
const parse = (raw: string): string[] => {
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
};

export function useFavoritos() {
  const raw = useSyncExternalStore(subscribe, read, () => "[]");
  const favs = useMemo(() => parse(raw), [raw]);
  const toggle = useCallback((code: string) => {
    const cur = parse(read());
    const next = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code];
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* sin storage */ }
    listeners.forEach((l) => l());
  }, []);
  return { favs, toggle, isFav: (code: string) => favs.includes(code) };
}
