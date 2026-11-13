import type { Bundle, FhirResource } from "fhir/r4";
import { env } from "@/lib/env";
import { fhirAuthHeader } from "@/lib/fhir/auth";

export type FhirErrorKind = "not-configured" | "unavailable" | "timeout" | "http" | "bad-link";

export class FhirError extends Error {
  constructor(
    public kind: FhirErrorKind,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "FhirError";
  }
}

export type FhirFetchOptions = {
  baseUrl?: string;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
};

// Statuses a scaled-to-zero or overloaded server returns while it wakes up.
const RETRYABLE = new Set([429, 502, 503, 504]);

const FHIR_ID = /^[A-Za-z0-9.-]{1,64}$/;
export const isFhirId = (id: string) => FHIR_ID.test(id);

function resolveUrl(pathOrUrl: string, baseUrl: string | undefined) {
  if (!baseUrl) throw new FhirError("not-configured", "FHIR_BASE_URL is not set");
  const base = baseUrl.replace(/\/$/, "");
  if (!/^https?:\/\//.test(pathOrUrl)) return `${base}/${pathOrUrl.replace(/^\//, "")}`;
  // Paging links come from the server; never follow one to a different host.
  if (new URL(pathOrUrl).origin !== new URL(base).origin) {
    throw new FhirError("bad-link", "FHIR paging link points to a different host");
  }
  return pathOrUrl;
}

/** GET a FHIR resource or Bundle. Returns null for 404/410. Retries while the server wakes. */
export async function fhirFetch<T>(pathOrUrl: string, opts: FhirFetchOptions = {}): Promise<T | null> {
  const { timeoutMs = 15_000, retries = 2, retryDelayMs = 1_000 } = opts;
  const url = resolveUrl(pathOrUrl, opts.baseUrl ?? env.FHIR_BASE_URL);

  let last: FhirError | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, retryDelayMs * attempt));
    let res: Response;
    try {
      res = await fetch(url, {
        cache: "no-store",
        headers: { Accept: "application/fhir+json", ...(await fhirAuthHeader(new URL(url).origin)) },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      const timedOut = e instanceof Error && e.name === "TimeoutError";
      last = timedOut
        ? new FhirError("timeout", `FHIR server did not answer within ${timeoutMs} ms`)
        : new FhirError("unavailable", "FHIR server is unreachable");
      continue;
    }
    if (res.ok) return (await res.json()) as T;
    if (res.status === 404 || res.status === 410) return null;
    if (!RETRYABLE.has(res.status)) {
      throw new FhirError("http", `FHIR request failed with status ${res.status}`, res.status);
    }
    last = new FhirError("unavailable", `FHIR server returned ${res.status}`, res.status);
  }
  throw last!;
}

/** Runs a search and follows "next" links until every page is read. */
export async function fhirSearch<T extends FhirResource>(
  query: string,
  opts: FhirFetchOptions & { maxPages?: number } = {},
): Promise<T[]> {
  const { maxPages = 50 } = opts;
  const resources: T[] = [];
  let next: string | undefined = query;
  for (let page = 0; next && page < maxPages; page++) {
    const bundle: Bundle | null = await fhirFetch<Bundle>(next, opts);
    if (!bundle) break;
    for (const entry of bundle.entry ?? []) {
      // The server may append an OperationOutcome entry (search.mode "outcome"); it is not a result.
      if (entry.resource && entry.search?.mode !== "outcome") resources.push(entry.resource as T);
    }
    next = bundle.link?.find((l) => l.relation === "next")?.url;
  }
  return resources;
}
