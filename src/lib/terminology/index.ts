import "server-only";
import { env } from "@/lib/env";
import offline from "../../../data/terminology/offline.json";
import targets from "../../../services/nlp/targets.json";
import { type CodingResult, type Config, type Recorded, NCTS_BASE, codeTerm } from "./client";

const recorded = offline as unknown as Recorded;

/** NCTS if credentials are set, else the server in TERMINOLOGY_BASE_URL (the CSIRO test endpoint), else offline. */
export function configured(): Config {
  if (env.TERMINOLOGY_CLIENT_ID && env.TERMINOLOGY_CLIENT_SECRET) {
    return {
      backend: "ncts",
      base: env.TERMINOLOGY_BASE_URL ?? NCTS_BASE,
      clientId: env.TERMINOLOGY_CLIENT_ID,
      clientSecret: env.TERMINOLOGY_CLIENT_SECRET,
    };
  }
  if (env.TERMINOLOGY_BASE_URL) return { backend: "csiro", base: env.TERMINOLOGY_BASE_URL };
  return { backend: "offline", recorded };
}

/** Codes a term. A live server that fails is replaced by the offline subset, and the result says so. */
export async function codeCondition(query: string): Promise<CodingResult & { fallback?: string }> {
  const cfg = configured();
  try {
    return await codeTerm(query, cfg, targets.targets);
  } catch {
    if (cfg.backend === "offline") throw new Error("offline terminology failed");
    return {
      ...(await codeTerm(query, { backend: "offline", recorded }, targets.targets)),
      fallback: "the terminology server did not answer",
    };
  }
}
