import "server-only";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/** True when the request carries the integration key (the n8n workflows) in `x-api-key`. */
export function hasIntegrationKey(request: Request): boolean {
  const want = env.INTEGRATION_API_KEY;
  const given = request.headers.get("x-api-key");
  if (!want || !given) return false;
  const [a, b] = [Buffer.from(given), Buffer.from(want)];
  return a.length === b.length && timingSafeEqual(a, b);
}
