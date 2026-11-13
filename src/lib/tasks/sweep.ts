import "server-only";
import type { BundleEntry, Patient } from "fhir/r4";
import { inputsForChart } from "@/lib/cds/prefetch";
import { careGaps } from "@/lib/cds/rules";
import { getConditions } from "@/lib/fhir";
import { fhirSearch } from "@/lib/fhir/client";
import { validateBundle, writeBundle } from "@/lib/fhir/write";
import { buildGapTask, countResponses, gapBundle } from "./care-gap";

const CONCURRENCY = 4;

/** Finds open care gaps for every patient (the same rules as the CDS card) and creates one Task per gap, once. */
export async function runSweep(opts: { dryRun?: boolean; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const patients = await fhirSearch<Patient>("Patient?_count=100");
  const entries: BundleEntry[] = [];
  const gaps: { patientId: string; type: string }[] = [];
  for (let i = 0; i < patients.length; i += CONCURRENCY) {
    await Promise.all(
      patients.slice(i, i + CONCURRENCY).map(async (p) => {
        const id = p.id!;
        const conditions = await getConditions(id);
        for (const gap of careGaps(await inputsForChart(id, p, conditions), now)) {
          gaps.push({ patientId: id, type: gap.type });
          entries.push(buildGapTask(id, gap, now));
        }
      }),
    );
  }
  if (!entries.length)
    return { patients: patients.length, gaps: 0, created: 0, existing: 0, dryRun: Boolean(opts.dryRun) };
  const bundle = gapBundle(entries);
  const errors = await validateBundle(bundle);
  if (errors.length) throw new Error(`FHIR validation failed: ${errors[0]}`);
  if (opts.dryRun)
    return { patients: patients.length, gaps: entries.length, created: 0, existing: 0, dryRun: true };
  return {
    patients: patients.length,
    gaps: entries.length,
    ...countResponses(await writeBundle(bundle)),
    dryRun: false,
  };
}
