import { z } from "zod";

const optional = z.string().trim().min(1).optional();

// Empty strings in .env files count as "not set".
const schema = z.preprocess(
  (raw) => Object.fromEntries(Object.entries(raw as object).filter(([, v]) => v !== "")),
  z.object({
    FHIR_BASE_URL: z.url({ protocol: /^https?$/ }).optional(), // "localhost:8080/fhir" is not a web address
    FHIR_AUTH: z.enum(["none", "gcp-iam"]).default("none"),
    NEXT_PUBLIC_SUPABASE_URL: optional,
    SUPABASE_SECRET_KEY: optional,
    NLP_SERVICE_URL: optional,
    TERMINOLOGY_BASE_URL: optional,
    OPENROUTER_API_KEY: optional,
    SMART_CLIENT_ID: optional,
    INTEGRATION_API_KEY: optional,
  }),
);

/**
 * Reads the environment. A malformed value never crashes the app: that setting is treated as not
 * set and its name is listed in `invalid`, so the health check can say what is wrong.
 */
export function parseEnv(raw: Record<string, string | undefined>) {
  let input = { ...raw };
  let result = schema.safeParse(input);
  const invalid: string[] = [];
  if (!result.success) {
    for (const issue of result.error.issues) invalid.push(String(issue.path[0]));
    input = Object.fromEntries(Object.entries(input).filter(([key]) => !invalid.includes(key)));
    result = schema.safeParse(input);
  }
  if (!result.success) throw result.error; // unreachable: every field is optional or has a default
  const env = result.data;
  return {
    env,
    invalid,
    flags: {
      fhir: Boolean(env.FHIR_BASE_URL),
      supabase: Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SECRET_KEY),
      nlp: Boolean(env.NLP_SERVICE_URL),
      terminology: Boolean(env.TERMINOLOGY_BASE_URL),
      ai: Boolean(env.OPENROUTER_API_KEY),
      smart: Boolean(env.SMART_CLIENT_ID),
      n8n: Boolean(env.INTEGRATION_API_KEY),
    },
  };
}

export const { env, flags, invalid: invalidSettings } = parseEnv(process.env);
