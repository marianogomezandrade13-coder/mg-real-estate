"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useInView } from "./Reveal";

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (cb: () => void) => {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** Cuenta de 0 a `to` cuando entra en pantalla. Con prefers-reduced-motion muestra el valor final. */
export function CountUp({ to, prefix = "", duration = 1800 }: { to: number; prefix?: string; duration?: number }) {
  const { ref, visible } = useInView<HTMLSpanElement>(0.4);
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => false);
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!visible || reduced) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - t0) / duration, 1);
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p); // easeOutExpo
      setN(Math.round(to * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, reduced, to, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {(reduced ? to : n).toLocaleString("es-AR")}
    </span>
  );
}
