const WINDOW_MS = 60_000;
export const CDS_LIMIT = 60;
const hits = new Map<string, { n: number; reset: number }>();

/** True when this caller has used its CDS_LIMIT requests in the current minute.
 * shortcut: per server instance, not shared; fine to blunt a flood on a public no-I/O endpoint, use a shared store for a hard limit. */
export function rateLimited(caller: string, now = Date.now()): boolean {
  if (hits.size > 1000) for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  const h = hits.get(caller);
  if (!h || h.reset <= now) {
    hits.set(caller, { n: 1, reset: now + WINDOW_MS });
    return false;
  }
  return ++h.n > CDS_LIMIT;
}
