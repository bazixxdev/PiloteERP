"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtEuro } from "@/lib/format";

// Courbe du solde fin de mois sur la fenêtre, avec le seuil d'alerte. Une seule série : la lecture est « où passe-t-on sous
// le seuil, et quand ».
export function BalanceChart({ points, threshold }: { points: { month: string; label: string; balance: number }[]; threshold: number }) {
  const min = Math.min(0, threshold, ...points.map((p) => p.balance));
  return (
    <div className="h-52 w-full" data-testid="treasury-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
          <defs><linearGradient id="bal" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1b6a8a" stopOpacity={0.25} /><stop offset="100%" stopColor="#1b6a8a" stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid stroke="#e3e9eb" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={64} domain={[min, "auto"]} tickFormatter={(v: number) => `${Math.round(v / 1000)} k€`} />
          <Tooltip formatter={(v) => fmtEuro(Number(v))} labelFormatter={(l) => String(l)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <ReferenceLine y={threshold} stroke="#8c601b" strokeDasharray="4 4" label={{ value: "seuil", fontSize: 10, fill: "#8c601b", position: "insideTopLeft" }} />
          <ReferenceLine y={0} stroke="#b04a3a" strokeWidth={1} />
          <Area type="monotone" dataKey="balance" name="Solde" stroke="#1b6a8a" strokeWidth={2} fill="url(#bal)" dot={{ r: 2.5 }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
