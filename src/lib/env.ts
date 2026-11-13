import { z } from "zod";

const optional = z.string().trim().min(1).optional();

// Empty strings in .env files count as "not set".
const schema = z.preprocess(
  (raw) => Object.fromEntries(Object.entries(raw as object).filter(([, v]) => v !== "")),
  z.object({
    FHIR_BASE_URL: z.url().optional(),
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

export function parseEnv(raw: Record<string, string | undefined>) {
  const env = schema.parse(raw);
  return {
    env,
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

export const { env, flags } = parseEnv(process.env);
