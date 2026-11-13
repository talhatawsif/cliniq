import { readFileSync } from "node:fs";

export type Wf = {
  name: string;
  nodes: { name: string }[];
  connections: Record<string, { main: { node: string }[][] }>;
};
export const load = (f: string) => JSON.parse(readFileSync(`n8n/workflows/${f}.json`, "utf8")) as Wf;

export function diagram(wf: Wf, accent: string) {
  // Layers by shortest path from the nodes nothing points to.
  const targets = new Set(Object.values(wf.connections).flatMap((c) => c.main.flat().map((l) => l.node)));
  const layer = new Map<string, number>(wf.nodes.filter((n) => !targets.has(n.name)).map((n) => [n.name, 0]));
  // Breadth first: the first time a node is reached is its layer, so a loop back (retry) does not push anything down.
  for (let queue = [...layer.keys()]; queue.length;) {
    const from = queue.shift()!;
    for (const l of wf.connections[from]?.main.flat() ?? []) {
      if (!layer.has(l.node)) {
        layer.set(l.node, layer.get(from)! + 1);
        queue.push(l.node);
      }
    }
  }
  const rows = new Map<number, string[]>();
  for (const [n, l] of layer) rows.set(l, [...(rows.get(l) ?? []), n]);
  const W = 150,
    H = 38,
    GX = 22,
    GY = 26;
  const pos = new Map<string, { x: number; y: number }>();
  const maxCols = Math.max(...[...rows.values()].map((r) => r.length));
  for (const [l, names] of rows)
    names.forEach((n, i) =>
      pos.set(n, { x: 20 + (i + (maxCols - names.length) / 2) * (W + GX), y: 14 + l * (H + GY) }),
    );
  const lines = Object.entries(wf.connections).flatMap(([from, c]) =>
    c.main.flat().map((l) => {
      const a = pos.get(from),
        b = pos.get(l.node);
      // A loop back (the retry) is written on the "Back off" box instead of drawn.
      return a && b && b.y > a.y
        ? `<line x1="${a.x + W / 2}" y1="${a.y + H}" x2="${b.x + W / 2}" y2="${b.y}" stroke="#7b8ea3" stroke-width="1.6" marker-end="url(#ar)"/>`
        : "";
    }),
  );
  const boxes = [...pos].map(
    ([n, p]) =>
      `<g><rect x="${p.x}" y="${p.y}" width="${W}" height="${H}" rx="7" fill="#1f3044" stroke="${accent}" stroke-width="1.6"/><text x="${p.x + W / 2}" y="${p.y + 24}" fill="#fff" font-size="13" text-anchor="middle" font-family="system-ui">${n === "Back off" ? "Back off 2/4/8 s, retry" : n}</text></g>`,
  );
  const w = 80 + maxCols * (W + GX),
    h = 30 + rows.size * (H + GY);
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;max-height:600px"><defs><marker id="ar" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#7b8ea3"/></marker></defs>${lines.join("")}${boxes.join("")}</svg>`;
}
