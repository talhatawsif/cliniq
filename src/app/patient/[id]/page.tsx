import type { Metadata } from "next";
import { connection } from "next/server";
import DataTable from "@/components/DataTable";
import FhirNotice from "@/components/FhirNotice";
import { JsonButton } from "@/components/JsonDrawer";
import { inputsForChart } from "@/lib/cds/prefetch";
import { evaluate } from "@/lib/cds/rules";
import {
  FhirError,
  allergyStatus,
  codeableText,
  formatDate,
  getAllergies,
  getChartData,
  getConditions,
  getPatient,
  medicationName,
  problemList,
} from "@/lib/fhir";

export const metadata: Metadata = { title: "Patient chart" };

const SYSTEMS: Record<string, string> = {
  "http://www.nlm.nih.gov/research/umls/rxnorm": "RxNorm (US)",
  "http://snomed.info/sct": "SNOMED CT",
  "http://www.ama-assn.org/go/cpt": "CPT",
  "http://hl7.org/fhir/sid/cvx": "CVX",
  "http://hl7.org/fhir/sid/ndc": "NDC",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = title.toLowerCase();
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="mb-6 scroll-mt-36">
      <h2 id={`${id}-h`} className="mb-2 text-base font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function PatientChart({ params }: PageProps<"/patient/[id]">) {
  await connection();
  const { id } = await params;
  let data;
  try {
    const [patient, conditions, allergies, chart] = await Promise.all([
      getPatient(id),
      getConditions(id),
      getAllergies(id),
      getChartData(id),
    ]);
    // The same rules and prefetch queries as the CDS Hooks service.
    const cards = patient ? evaluate(await inputsForChart(id, patient, conditions)) : [];
    data = { conditions, allergies, cards, ...chart };
  } catch (e) {
    if (e instanceof FhirError) return <FhirNotice error={e} />;
    throw e;
  }
  const { conditions, allergies, cards, medications, medicationById, immunizations, encounters } = data;
  const problems = problemList(conditions);
  const allergyState = allergyStatus(allergies);
  const listedAllergies = allergies.filter(
    (a) => a.verificationStatus?.coding?.[0]?.code !== "entered-in-error",
  );
  const system = (c?: { coding?: { system?: string }[] }) =>
    SYSTEMS[c?.coding?.[0]?.system ?? ""] ?? "Local code";

  return (
    <>
      <h1 className="sr-only">Patient chart</h1>

      <Section title="Decision support">
        {cards.length === 0 ? (
          <p className="text-muted">No decision support cards for this record.</p>
        ) : (
          <ul className="border-y border-line bg-surface">
            {cards.map((c) => (
              <li key={c.uuid} className="border-b border-line px-3 py-2 last:border-b-0">
                <p>
                  <span
                    className={
                      c.indicator === "info"
                        ? "text-muted"
                        : c.indicator === "warning"
                          ? "text-warning"
                          : "text-critical"
                    }
                  >
                    {c.indicator === "info" ? "Info" : c.indicator === "warning" ? "▲ Warning" : "▲ Critical"}
                  </span>{" "}
                  · {c.summary}
                </p>
                {c.detail && <p className="text-[13px] text-muted">{c.detail}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Problems">
        <DataTable
          caption="Active problems"
          rows={problems.active}
          rowKey={(c) => c.id ?? ""}
          empty="No active problems recorded."
          columns={[
            { header: "Problem", cell: (c) => codeableText(c.code, "Unknown condition") },
            {
              header: "Verification",
              cell: (c) => {
                const v = c.verificationStatus?.coding?.[0]?.code ?? "not recorded";
                return v === "confirmed" ? v : <span className="machine px-1">Auto-extracted — {v}</span>;
              },
            },
            { header: "Onset", cell: (c) => formatDate(c.onsetDateTime ?? c.recordedDate) },
            { header: "Record", cell: (c) => <JsonButton resource={c} label={codeableText(c.code)} /> },
          ]}
        />
        {problems.inactive.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-[13px] text-muted">
              Resolved and inactive ({problems.inactive.length})
            </summary>
            <DataTable
              caption="Resolved and inactive problems"
              rows={problems.inactive}
              rowKey={(c) => c.id ?? ""}
              empty=""
              columns={[
                { header: "Problem", cell: (c) => codeableText(c.code, "Unknown condition") },
                { header: "Status", cell: (c) => c.clinicalStatus?.coding?.[0]?.code ?? "—" },
                { header: "Onset", cell: (c) => formatDate(c.onsetDateTime ?? c.recordedDate) },
                { header: "Record", cell: (c) => <JsonButton resource={c} label={codeableText(c.code)} /> },
              ]}
            />
          </details>
        )}
      </Section>

      <Section title="Medicines">
        <DataTable
          caption="Active medicines"
          rows={medications}
          rowKey={(m) => m.id ?? ""}
          empty="No active medicines recorded."
          columns={[
            { header: "Medicine", cell: (m) => medicationName(m, medicationById) },
            { header: "Directions", cell: (m) => m.dosageInstruction?.[0]?.text ?? "—" },
            {
              header: "Code system",
              cell: (m) =>
                system(
                  m.medicationCodeableConcept ??
                    medicationById.get(m.medicationReference?.reference?.split("/")[1] ?? "")?.code,
                ),
            },
            { header: "Started", cell: (m) => formatDate(m.authoredOn) },
            {
              header: "Record",
              cell: (m) => <JsonButton resource={m} label={medicationName(m, medicationById)} />,
            },
          ]}
        />
      </Section>

      <Section title="Allergies">
        <DataTable
          caption="Allergies and intolerances"
          rows={listedAllergies}
          rowKey={(a) => a.id ?? ""}
          empty={allergyState === "none-recorded" ? "No allergies recorded." : "No known allergies."}
          columns={[
            { header: "Substance", cell: (a) => codeableText(a.code, "Unknown allergen") },
            { header: "Criticality", cell: (a) => a.criticality ?? "not recorded" },
            {
              header: "Reaction",
              cell: (a) => a.reaction?.[0]?.manifestation?.map((m) => codeableText(m)).join(", ") ?? "—",
            },
            { header: "Recorded", cell: (a) => formatDate(a.recordedDate ?? a.onsetDateTime) },
            { header: "Record", cell: (a) => <JsonButton resource={a} label={codeableText(a.code)} /> },
          ]}
        />
      </Section>

      <Section title="Immunisations">
        <DataTable
          caption="Immunisations"
          rows={immunizations}
          rowKey={(i) => i.id ?? ""}
          empty="No immunisations recorded."
          columns={[
            { header: "Vaccine", cell: (i) => codeableText(i.vaccineCode) },
            { header: "Status", cell: (i) => i.status },
            { header: "Date", cell: (i) => formatDate(i.occurrenceDateTime) },
            {
              header: "Record",
              cell: (i) => <JsonButton resource={i} label={codeableText(i.vaccineCode)} />,
            },
          ]}
        />
      </Section>

      <Section title="Encounters">
        <DataTable
          caption="Encounter timeline"
          rows={encounters}
          rowKey={(e) => e.id ?? ""}
          empty="No encounters recorded."
          columns={[
            { header: "Date", cell: (e) => formatDate(e.period?.start) },
            {
              header: "Type",
              cell: (e) => codeableText(e.type?.[0], e.class?.display ?? e.class?.code ?? "Encounter"),
            },
            { header: "Reason", cell: (e) => (e.reasonCode?.[0] ? codeableText(e.reasonCode[0]) : "—") },
            { header: "Status", cell: (e) => e.status },
            { header: "Record", cell: (e) => <JsonButton resource={e} label="encounter" /> },
          ]}
        />
      </Section>
    </>
  );
}
