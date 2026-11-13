import "server-only";
import { admin } from "@/lib/supabase";

/** Daily global caps (UTC day) so a public demo cannot fill the database or burn free-tier limits. */
export const LIMITS = { hl7: 50, pipeline: 50, assistant: 40 } as const;
export const MAX_BODY_BYTES = 50_000;

/** Takes one unit of a daily quota. False means the limit is reached. */
export async function consumeQuota(name: string, limit: number) {
  const { data, error } = await admin().rpc("consume_quota", { p_name: name, p_limit: limit });
  if (error) throw new Error(`quota check failed: ${error.code}`);
  return data === true;
}

/** Checks a text body is at most 50 kB, then takes one unit. Returns null when allowed, else the refusal. */
export async function guardText(text: string, name: keyof typeof LIMITS, limit: number = LIMITS[name]) {
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return Response.json({ error: "Request body over 50 kB" }, { status: 413 });
  }
  if (!(await consumeQuota(name, limit))) {
    return Response.json(
      { error: "Daily limit reached for this demo. Try again tomorrow (UTC)." },
      { status: 429 },
    );
  }
  return null;
}

/** For route handlers: reads the body and applies guardText. Returns the text or an error Response. */
export async function guardRequest(
  request: Request,
  name: keyof typeof LIMITS,
  limit: number = LIMITS[name],
) {
  const text = await request.text();
  return (await guardText(text, name, limit)) ?? text;
}
