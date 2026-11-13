import type { Metadata } from "next";
import { connection } from "next/server";
import { banner, getPatientsPage } from "@/lib/fhir";
import { listSampleNotes, noteText } from "@/lib/pipeline/run";
import PipelineForm from "./PipelineForm";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  await connection();
  const [notes, { patients }] = await Promise.all([listSampleNotes(), getPatientsPage("", 1)]);
  const samples = notes.map((d) => ({
    id: d.id!,
    title: d.description ?? d.id!,
    patientId: d.subject?.reference?.split("/")[1] ?? "",
    text: noteText(d),
  }));
  const names = patients.map((p) => ({ id: p.id!, name: `${banner(p).family}, ${banner(p).given}` }));
  return (
    <main className="flex-1 space-y-4 px-4 py-4 xl:px-6">
      <h1 className="text-xl font-semibold">Note to coded FHIR</h1>
      <p className="text-muted">
        Extract findings from a clinical note, code them to SNOMED CT-AU, validate, and write them as
        unconfirmed Conditions with Provenance. Negated, family, hypothetical, uncertain and historical
        mentions are never written. Every finding waits for a clinician in the{" "}
        <a href="/review">review queue</a>.
      </p>
      <PipelineForm samples={samples} patients={names} />
    </main>
  );
}
