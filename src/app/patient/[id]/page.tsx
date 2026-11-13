import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import DataTable from "@/components/DataTable";
import FhirNotice from "@/components/FhirNotice";
import {
  FhirError,
  allergyStatus,
  banner,
  codeableText,
  formatDate,
  getPatientDetail,
  medicationName,
  problemList,
} from "@/lib/fhir";

export const metadata: Metadata = { title: "Patient chart" };

const SECTIONS = ["Problems", "Medicines", "Allergies", "Immunisations", "Encounters"];
const id = (s: string) => s.toLowerCase();
const SYSTEMS: Record<string, string> = {
  "http://www.nlm.nih.gov/research/umls/rxnorm": "RxNorm (US)",
  "http://snomed.info/sct": "SNOMED CT",
  "http://www.ama-assn.org/go/cpt": "CPT",
  "http://hl7.org/fhir/sid/cvx": "CVX",
  "http://hl7.org/fhir/sid/ndc": "NDC",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section id={id(title)} aria-labelledby={`${id(title)}-h`} className="mb-6 scroll-mt-36">
      <h2 id={`${id(title)}-h`} className="mb-2 text-base font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function PatientChart({ params }: PageProps<"/patient/[id]">) {
  await connection();
  const { id: patientId } = await params;
  let detail;
  try {
    detail = await getPatientDetail(patientId);
  } catch (e) {
    if (e instanceof FhirError) return <FhirNotice error={e} />;
    throw e;
  }
  if (!detail) notFound();

  const { patient, conditions, allergies, medications, medicationById, immunizations, encounters } = detail;
  const b = banner(patient);
  const problems = problemList(conditions);
  const allergyState = allergyStatus(allergies);
  const listedAllergies = allergies.filter(
    (a) => a.verificationStatus?.coding?.[0]?.code !== "entered-in-error",
  );
  const system = (c?: { coding?: { system?: string }[] }) =>
    SYSTEMS[c?.coding?.[0]?.system ?? ""] ?? "Local code";

  return (
    <>
      <div
        className={`sticky top-12 z-10 border-b bg-surface px-4 py-2 xl:px-6 ${b.deceased ? "border-line-strong" : "border-line"}`}
      >
        <p className="tabular text-[15px]" data-testid="banner">
          <span className="font-semibold">
            {b.family}, {b.given}
          </span>
          {" · "}DOB {b.dob} ({b.status}){" · "}
          <span className="capitalize">{b.sex}</span>
          {" · "}IHI <span className="font-mono">{b.ihi ?? "not recorded"}</span>
        </p>
        <p className="text-[13px]" data-testid="banner-allergies">
          {allergyState === "listed" ? (
            <span className="text-critical">
              ▲ Allergies:{" "}
              {listedAllergies
                .map(
                  (a) =>
                    `${codeableText(a.code, "Unknown allergen")}${a.criticality ? ` (${a.criticality})` : ""}`,
                )
                .join(" · ")}
            </span>
          ) : (
            <span className="text-muted">
              {allergyState === "no-known" ? "No known allergies" : "No allergies recorded"}
            </span>
          )}
          <span className="text-muted">
            {" · "}
            {problems.active.length} active {problems.active.length === 1 ? "problem" : "problems"}
          </span>
        </p>
      </div>

      <div className="flex flex-1 flex-col md:flex-row">
        <nav
          aria-label="Chart sections"
          className="border-b border-line p-4 md:w-48 md:border-b-0 md:border-r md:p-4"
        >
          <ul className="flex flex-wrap gap-x-4 gap-y-1 md:flex-col">
            {SECTIONS.map((s) => (
              <li key={s}>
                <a href={`#${id(s)}`}>{s}</a>
              </li>
            ))}
            <li className="md:mt-3">
              <Link href="/patients">All patients</Link>
            </li>
          </ul>
        </nav>

        <main className="min-w-0 flex-1 p-4 xl:p-6">
          <h1 className="sr-only">Patient chart</h1>

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
              ]}
            />
          </Section>
        </main>
      </div>
    </>
  );
}
