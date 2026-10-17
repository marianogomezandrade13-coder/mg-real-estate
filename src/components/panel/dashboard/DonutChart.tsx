"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

export type Porcion = { name: string; value: number; color: string };

export function OperacionesDonut({ data, total }: { data: Porcion[]; total: number }) {
  return (
    <div className="flex items-center gap-6">
      <div className="relative w-[140px] h-[140px] flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={46}
              outerRadius={66}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v) => [`${v}`, ""]}
              contentStyle={{
                background: "#16201B",
                border: "none",
                borderRadius: 10,
                color: "#fff",
                fontSize: 13,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[22px] font-bold text-[#1F2421] font-[family-name:var(--font-space-grotesk)]">
            {total}
          </span>
          <span className="text-[10px] text-[#676B63]">propiedades</span>
        </div>
      </div>

      <div className="space-y-2.5">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: item.color }}
            />
            <span className="text-[13px] text-[#565B56]">
              {item.name} · <span className="font-semibold text-[#1F2421]">{item.value}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
