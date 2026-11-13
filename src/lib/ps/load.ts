import "server-only";
import type { Practitioner } from "fhir/r4";
import { getAllergies, getChartData, getConditions, getObservations, getPatient } from "@/lib/fhir";
import { fhirSearch } from "@/lib/fhir/client";
import { buildPatientSummary } from "./build";

/** The AU Patient Summary document for a patient, or null if there is no such patient. */
export async function loadSummary(id: string) {
  const patient = await getPatient(id);
  if (!patient) return null;
  const [conditions, allergies, chart, results] = await Promise.all([
    getConditions(id),
    getAllergies(id),
    getChartData(id),
    getObservations(id, "laboratory"),
  ]);
  const requesters = [
    ...new Set(
      chart.medications.flatMap((m) => (m.requester?.reference ? [m.requester.reference.split("/")[1]] : [])),
    ),
  ];
  const practitioners = requesters.length
    ? await fhirSearch<Practitioner>(`Practitioner?_id=${requesters.join(",")}`)
    : [];
  return buildPatientSummary({ patient, conditions, allergies, ...chart, results, practitioners });
}
