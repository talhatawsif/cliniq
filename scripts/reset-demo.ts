// Wipes every FHIR resource ($expunge) and reloads the cohort. Same targets as load.ts:
// local by default; cloud with LOAD_BASE and LOAD_TOKEN. The server needs HAPI_FHIR_EXPUNGE_ENABLED=true.
import { execFileSync } from "node:child_process";

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
execFileSync("node", ["scripts/load.ts"], { stdio: "inherit" });
