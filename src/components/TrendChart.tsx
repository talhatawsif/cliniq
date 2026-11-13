"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ChartPoint = { t: number; value: number; abnormal: boolean; series?: string };
export type ChartLine = { name: string; points: ChartPoint[]; color: string };

const date = (t: number) =>
  new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(t);

// Real measurements get a marker; abnormal ones a diamond instead of a circle.
function Marker({
  cx,
  cy,
  payload,
  stroke,
}: {
  cx?: number;
  cy?: number;
  payload?: ChartPoint;
  stroke?: string;
}) {
  if (cx === undefined || cy === undefined) return null;
  return payload?.abnormal ? (
    <path
      d={`M${cx} ${cy - 6}L${cx + 6} ${cy}L${cx} ${cy + 6}L${cx - 6} ${cy}Z`}
      fill="var(--surface)"
      stroke={stroke}
      strokeWidth={2}
    />
  ) : (
    <circle cx={cx} cy={cy} r={3.5} fill={stroke} />
  );
}

/** Straight segments, true time axis, no animation. Series with no real points are not drawn. */
export default function TrendChart({
  title,
  unit,
  lines,
  band: range,
}: {
  title: string;
  unit: string;
  lines: ChartLine[];
  band?: { low?: number; high?: number };
}) {
  const [table, setTable] = useState(false);
  const all = lines.flatMap((l) => l.points);
  const times = all.map((p) => p.t);
  return (
    <figure className="mb-6">
      <figcaption className="mb-1 flex items-baseline gap-3">
        <span className="font-semibold">{title}</span>
        <span className="text-[13px] text-muted">{unit}</span>
        <button
          type="button"
          className="ml-auto text-[13px] text-accent underline"
          aria-pressed={table}
          onClick={() => setTable(!table)}
        >
          {table ? "Show chart" : "Show table"}
        </button>
      </figcaption>
      {table ? (
        <table className="w-full border-collapse border-y border-line text-left">
          <thead className="bg-sunken text-xs text-muted">
            <tr>
              <th className="h-8 px-3 font-medium">Date</th>
              <th className="h-8 px-3 font-medium">Series</th>
              <th className="h-8 px-3 text-right font-medium">Value ({unit})</th>
            </tr>
          </thead>
          <tbody>
            {lines.flatMap((l) =>
              [...l.points].reverse().map((p) => (
                <tr key={`${l.name}${p.t}`} className="border-t border-line">
                  <td className="px-3 py-1">{date(p.t)}</td>
                  <td className="px-3 py-1">{l.name}</td>
                  <td className="px-3 py-1 text-right">{p.value.toFixed(p.value % 1 ? 1 : 0)}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      ) : (
        <div
          className="h-56 rounded border border-line bg-surface"
          role="img"
          aria-label={`${title} trend, ${all.length} results`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart margin={{ top: 12, right: 40, bottom: 4, left: 4 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={[Math.min(...times), Math.max(...times)]}
                tickFormatter={date}
                tick={{ fill: "var(--muted)", fontSize: 12 }}
                stroke="var(--line-strong)"
              />
              <YAxis
                tick={{ fill: "var(--muted)", fontSize: 12 }}
                stroke="var(--line-strong)"
                width={48}
                domain={["auto", "auto"]}
              />
              {range && (range.low !== undefined || range.high !== undefined) && (
                <ReferenceArea y1={range.low} y2={range.high} fill="var(--sunken)" fillOpacity={1} />
              )}
              <Tooltip
                labelFormatter={(t) => date(Number(t))}
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--line-strong)",
                  borderRadius: 4,
                  color: "var(--fg)",
                }}
              />
              {lines.map((l) => (
                <Line
                  key={l.name}
                  name={l.name}
                  data={l.points}
                  dataKey="value"
                  type="linear"
                  stroke={l.color}
                  strokeWidth={1.5}
                  dot={<Marker />}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {lines.length > 1 && (
        <p className="mt-1 text-[13px] text-muted">
          {lines.map((l) => (
            <span key={l.name} className="mr-4">
              <span aria-hidden style={{ color: l.color }}>
                ━
              </span>{" "}
              {l.name}
            </span>
          ))}
        </p>
      )}
    </figure>
  );
}
