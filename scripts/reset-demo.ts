// Wipes every FHIR resource ($expunge) and reloads the cohort. Same targets as load.ts:
// local by default; cloud with LOAD_BASE and LOAD_TOKEN. The server needs HAPI_FHIR_EXPUNGE_ENABLED=true.
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.LOAD_BASE ?? "http://localhost:8080/fhir";
// Wipes everything: anything but the local server needs the target repeated in CONFIRM_RESET.
if (!/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(BASE) && process.env.CONFIRM_RESET !== BASE)
  throw new Error(`Refusing to wipe ${BASE}. Set CONFIRM_RESET=${BASE} to confirm.`);
const headers: Record<string, string> = { "Content-Type": "application/fhir+json" };
if (process.env.LOAD_TOKEN) headers.Authorization = `Bearer ${process.env.LOAD_TOKEN}`;

const res = await fetch(`${BASE}/$expunge`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    resourceType: "Parameters",
    parameter: [
      { name: "expungeEverything", valueBoolean: true },
      { name: "expungeDeletedResources", valueBoolean: true },
      { name: "expungeOldVersions", valueBoolean: true },
    ],
  }),
});
if (!res.ok) throw new Error(`expunge failed: ${res.status} (is HAPI_FHIR_EXPUNGE_ENABLED=true set?)`);
console.log("expunged");

// The review queue and the HL7 message log (Supabase) point at resources that no longer exist: a queued finding cannot be
// confirmed, and a message logged as accepted is never written again. Supabase is shared by every environment, so clearing
// is opt-in: CLEAN_QUEUE=1 deletes both tables' rows (including rows for another FHIR server that uses the same project).
try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local
}
const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: key } = process.env;
if (process.env.CLEAN_QUEUE === "1" && url && key) {
  const db = createClient(url, key, { auth: { persistSession: false } });
  for (const table of ["review_items", "hl7_messages"]) {
    const { error } = await db.from(table).delete().not("id", "is", null);
    console.log(error ? `could not clear ${table}: ${error.code}` : `cleared ${table}`);
  }
} else {
  console.log("review_items and hl7_messages kept: run again with CLEAN_QUEUE=1 if the queue shows findings that no longer exist");
}
execFileSync("node", ["scripts/load.ts"], { stdio: "inherit" });
