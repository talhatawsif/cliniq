// Records live $expand answers for every term and synonym in targets.json into data/terminology/offline.json,
// the offline backend. Usage: npm run terminology:record   (needs network; uses the CSIRO test endpoint)
import { writeFileSync } from "node:fs";
import targets from "../../services/nlp/targets.json" with { type: "json" };
import { type Config, expand } from "../../src/lib/terminology/client.ts";
import { ACCEPTANCE, NONSENSE } from "../../src/lib/terminology/acceptance.ts";

const BASE = process.env.TERMINOLOGY_BASE_URL ?? "https://tx.ontoserver.csiro.au/fhir";
const cfg: Config = { backend: "csiro", base: BASE };
const queries = [
  ...new Set(
    [
      ...ACCEPTANCE.map((a) => a[0]),
      NONSENSE,
      ...targets.targets.flatMap((t) => [t.term, ...t.synonyms]),
    ].map((q) => q.toLowerCase()),
  ),
];
const expansions: Record<string, unknown> = {};
let edition: string | null = null;
for (let i = 0; i < queries.length; i += 4) {
  await Promise.all(
    queries.slice(i, i + 4).map(async (q) => {
      const r = await expand(cfg, q, 10);
      edition ??= r.edition;
      expansions[q] = r.candidates;
    }),
  );
}
writeFileSync(
  "data/terminology/offline.json",
  JSON.stringify({ edition, recordedAt: new Date().toISOString().slice(0, 10), source: BASE, expansions }) +
    "\n",
);
console.log(`${queries.length} queries recorded, edition ${edition}`);
