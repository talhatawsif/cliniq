import type { Metadata } from "next";
import { connection } from "next/server";
import DataTable from "@/components/DataTable";
import { banner, getPatient } from "@/lib/fhir";
import { fhirFetch } from "@/lib/fhir/client";
import { listReview } from "@/lib/pipeline/review";
import { noteText } from "@/lib/pipeline/run";
import type { DocumentReference } from "fhir/r4";
import ReviewCard from "./ReviewCard";

export const metadata: Metadata = { title: "Review queue" };

export default async function ReviewPage() {
  await connection();
  const { pending, decided } = await listReview();
  const cards = await Promise.all(
    pending.map(async (i) => {
      const [patient, doc] = await Promise.all([
        getPatient(i.patient_id),
        fhirFetch<DocumentReference>(`DocumentReference/${i.document_id}`),
      ]);
      const text = doc ? noteText(doc) : "";
      const b = patient ? banner(patient) : null;
      return {
        id: i.id,
        patient: b
          ? `${b.family}, ${b.given} · DOB ${b.dob} (${b.status}) · IHI ${b.ihi ?? "not recorded"}`
          : `Patient/${i.patient_id}`,
        before: text.slice(Math.max(0, i.span_start - 120), i.span_start),
        span: text.slice(i.span_start, i.span_end) || i.term,
        after: text.slice(i.span_end, i.span_end + 120),
        code: i.code,
        display: i.display,
        confidence: Number(i.confidence),
        rationale: i.rationale,
        alternatives: i.alternatives,
        engine: i.engine,
      };
    }),
  );
  return (
    <main className="flex-1 space-y-6 px-4 py-4 xl:px-6">
      <h1 className="text-xl font-semibold">Review queue</h1>
      <p className="text-muted">
        Auto-extracted findings wait here. Until you confirm one it stays &ldquo;unconfirmed&rdquo; and is
        kept out of decision support and the patient summary. SNOMED CT-AU codes by the CSIRO test endpoint or
        the offline subset.
      </p>
      {cards.length === 0 ? (
        <p>
          Nothing to review. Run a note in the <a href="/pipeline">pipeline</a>.
        </p>
      ) : (
        <ul className="border-y border-line">
          {cards.map((c) => (
            <ReviewCard key={c.id} {...c} />
          ))}
        </ul>
      )}
      <section aria-labelledby="done-h">
        <h2 id="done-h" className="mb-2 text-base font-semibold">
          Recently decided
        </h2>
        <DataTable
          caption="Recently decided"
          rows={decided}
          rowKey={(r) => r.id}
          empty="No decisions yet."
          columns={[
            { header: "Finding", cell: (r) => `${r.code} ${r.display}` },
            { header: "Decision", cell: (r) => r.status },
            { header: "Patient", cell: (r) => <a href={`/patient/${r.patient_id}`}>Open chart</a> },
          ]}
        />
      </section>
    </main>
  );
}
