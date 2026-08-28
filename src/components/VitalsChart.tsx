"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function VitalsChart({ observations }: { observations: any[] }) {
  const grouped: Record<string, { date: string; value: number }[]> = {};

  observations.forEach((o) => {
    const label = o.code?.text || o.code?.coding?.[0]?.display;
    const value = o.valueQuantity?.value;
    const date = o.effectiveDateTime?.slice(0, 10);
    if (!label || value === undefined || !date) return;
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push({ date, value });
  });

  const chartable = Object.entries(grouped).filter(([, points]) => points.length >= 2);

  if (chartable.length === 0) {
    return <p className="text-sm text-gray-400">Not enough data points to chart trends.</p>;
  }

  return (
    <div className="space-y-6">
      {chartable.map(([label, points]) => (
        <div key={label}>
          <h3 className="text-sm font-medium mb-1">{label}</h3>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={points.sort((a, b) => a.date.localeCompare(b.date))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#2563eb" dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  );
}
