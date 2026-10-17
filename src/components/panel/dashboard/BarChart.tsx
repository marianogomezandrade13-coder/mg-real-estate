"use client";

import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export type PuntoBarra = { mes: string; valor: number };

export function IngresosBarchart({ data, unidad = "" }: { data: PuntoBarra[]; unidad?: string }) {
  const max = Math.max(...data.map((d) => d.valor));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <ReBarChart data={data} barCategoryGap="30%">
        <XAxis
          dataKey="mes"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#676B63" }}
        />
        <YAxis hide />
        <Tooltip
          cursor={{ fill: "rgba(169,60,132,0.06)" }}
          formatter={(v) => [`${v}${unidad}`, "Recibos"]}
          contentStyle={{
            background: "#16201B",
            border: "none",
            borderRadius: 10,
            color: "#fff",
            fontSize: 13,
          }}
        />
        <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
          {data.map((entry) => (
            <Cell
              key={entry.mes}
              fill={max > 0 && entry.valor === max ? "#8A6529" : "#D9BC85"}
            />
          ))}
        </Bar>
      </ReBarChart>
    </ResponsiveContainer>
  );
}
