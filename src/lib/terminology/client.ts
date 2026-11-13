// Terminology backends. No app imports, so scripts can use it: configuration is passed in.
import { type Candidate, type Target, aliasesFor, pick, rank, type Coding } from "./rank.ts";

export const SNOMED = "http://snomed.info/sct";
const AU_EDITION = "http://snomed.info/sct/32506021000036107"; // SNOMED CT-AU module
const CLINICAL_FINDING = "<404684003"; // ECL: descendants of "Clinical finding"
export const NCTS_BASE = "https://api.healthterminologies.gov.au/integration/v2/fhir";
const NCTS_TOKEN = "https://api.healthterminologies.gov.au/oauth2/token";

export type Backend = "ncts" | "csiro" | "offline";
export type Expansion = { candidates: Candidate[]; edition: string | null };
export type Recorded = {
  edition: string | null;
  recordedAt: string;
  source: string;
  expansions: Record<string, Candidate[]>;
};
export type Config =
  | { backend: "offline"; recorded: Recorded }
  | { backend: "csiro"; base: string }
  | { backend: "ncts"; base: string; clientId: string; clientSecret: string };

type ValueSet = {
  expansion?: {
    parameter?: { name: string; valueUri?: string }[];
    contains?: {
      code: string;
      display?: string;
      designation?: { use?: { code?: string }; value: string }[];
    }[];
  };
};
const FSN = "900000000000003001";

/** "http://snomed.info/sct|http://snomed.info/sct/32506021000036107/version/20261031" -> "SNOMED CT-AU 20261031" */
export function editionLabel(uri: string | undefined): string | null {
  const m = /sct\/(\d+)\/version\/(\d{8})/.exec(uri ?? "");
  return m ? `SNOMED CT${m[1] === "32506021000036107" ? "-AU" : ` (module ${m[1]})`} ${m[2]}` : null;
}

export function parseExpansion(vs: ValueSet): Expansion {
  const edition = editionLabel(vs.expansion?.parameter?.find((p) => p.name === "version")?.valueUri);
  const candidates = (vs.expansion?.contains ?? []).map((c) => ({
    code: c.code,
    display: c.display ?? c.code,
    names: (c.designation ?? []).filter((d) => d.use?.code !== FSN).map((d) => d.value),
  }));
  return { candidates, edition };
}

let tokenCache: { value: string; exp: number } | undefined;
async function nctsToken(cfg: { clientId: string; clientSecret: string }) {
  if (tokenCache && tokenCache.exp > Date.now() + 30_000) return tokenCache.value;
  const res = await fetch(NCTS_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`NCTS token request failed: ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

/** ValueSet/$expand over clinical findings in the SNOMED CT-AU edition. */
export async function expand(cfg: Config, term: string, count = 20): Promise<Expansion> {
  if (cfg.backend === "offline") {
    return { candidates: cfg.recorded.expansions[term.toLowerCase()] ?? [], edition: cfg.recorded.edition };
  }
  const url = new URL(`${cfg.base.replace(/\/$/, "")}/ValueSet/$expand`);
  url.searchParams.set("url", `${AU_EDITION}?fhir_vs=ecl/${CLINICAL_FINDING}`);
  url.searchParams.set("filter", term);
  url.searchParams.set("count", String(count));
  url.searchParams.set("includeDesignations", "true");
  const headers: Record<string, string> = { Accept: "application/fhir+json" };
  if (cfg.backend === "ncts") headers.Authorization = `Bearer ${await nctsToken(cfg)}`;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`terminology server returned ${res.status}`);
  return parseExpansion((await res.json()) as ValueSet);
}

export type CodingResult = {
  query: string;
  best: Coding | null;
  alternatives: Coding[];
  system: typeof SNOMED;
  edition: string | null;
  backend: Backend;
  /** Set when no code was chosen. */
  note?: string;
};

/** Candidates for the query and its expansions, ranked. */
export async function codeTerm(query: string, cfg: Config, targets: Target[]): Promise<CodingResult> {
  const { expansions } = aliasesFor(query, targets);
  const seen = new Map<string, Candidate>();
  let edition: string | null = null;
  for (const term of [query, ...expansions.slice(0, 3)]) {
    const r = await expand(cfg, term);
    edition ??= r.edition;
    for (const c of r.candidates) if (!seen.has(c.code)) seen.set(c.code, c);
  }
  const { best, alternatives } = pick(rank(query, expansions, [...seen.values()]));
  return {
    query,
    best,
    alternatives,
    system: SNOMED,
    edition,
    backend: cfg.backend,
    ...(best ? {} : { note: "No code: no candidate matched well enough" }),
  };
}
