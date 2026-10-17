import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  sub: string;
  /** Variación vs. el período anterior. Se omite (sin badge) cuando todavía no hay base de comparación. */
  trend?: number;
}

export function KpiCard({ label, value, sub, trend }: KpiCardProps) {
  const up = (trend ?? 0) >= 0;
  return (
    <div className="bg-white rounded-[16px] shadow-card p-5 flex flex-col gap-3 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-[#565B56] leading-tight">{label}</p>
        {trend != null && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0",
              up
                ? "bg-[#EAF7F0] text-[#1F9D5B]"
                : "bg-[#FBECEF] text-[#C0506A]"
            )}
          >
            {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-[28px] font-bold text-[#1F2421] leading-none font-[family-name:var(--font-space-grotesk)]">
        {value}
      </p>
      <p className="text-[12px] text-[#A3A69C]">{sub}</p>
    </div>
  );
}
