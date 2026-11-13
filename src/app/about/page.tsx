import type { Metadata } from "next";

export const metadata: Metadata = { title: "About" };

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-6">
    <h2 className="mb-2 text-base font-semibold">{title}</h2>
    <div className="space-y-2">{children}</div>
  </section>
);

export default function About() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <h1 className="mb-2 text-xl font-semibold">About ClinIQ</h1>
      <p className="mb-6 text-muted">
        A portfolio prototype for Australian health interoperability. All data is synthetic. It is not a
        medical device, has not been clinically validated, and makes no regulatory claim. Decision-support
        cards are informational demos.
      </p>

      <Section title="What it shows">
        <p>
          An EHR-style patient chart with pathology and vitals trends, a CDS Hooks decision-support service,
          and HL7 v2 pathology results mapped to FHIR and acknowledged with an ACK. The chart reads from a
          private FHIR R4 server in Sydney; the browser never contacts it directly.
        </p>
      </Section>

      <Section title="Standards and versions">
        <ul className="list-disc pl-5">
          <li>FHIR R4 on HAPI FHIR 8.12; cohort resources validated against AU Core 2.0.0</li>
          <li>IHI identifiers (reserved test values), LOINC, UCUM</li>
          <li>HL7 v2.4 ORU^R01 in the style of Australian pathology (AS 4700.2)</li>
          <li>CDS Hooks patient-view; CKD-EPI 2021 eGFR and BMI calculators</li>
        </ul>
      </Section>

      <Section title="Limitations">
        <ul className="list-disc pl-5">
          <li>Twenty synthetic patients; Synthea history is not Australian clinical practice.</li>
          <li>Everyone signs in as one shared demo user, so the audit log cannot tell visitors apart.</li>
          <li>
            The FHIR server sleeps when idle; the first request outside Australian daytime can take up to two
            minutes.
          </li>
          <li>
            Not built yet: AU Patient Summary export, terminology coding of notes, SMART launch, assistant.
          </li>
          <li>ICD-10-AM mapping needs an IHACPA licence, so it is not included.</li>
        </ul>
      </Section>

      <Section title="Path to production">
        <p>
          Real use would need: TGA assessment of software as a medical device (including the clinical decision
          support exemption), compliance with the Privacy Act and Australian Privacy Principles, the My Health
          Records Act and the Healthcare Identifiers Act (real IHIs may only be used by authorised parties),
          SNOMED CT-AU and ICD-10-AM licensing, per-user sign-in with MFA, Workload Identity Federation
          instead of a service-account key, and a write-once audit store.
        </p>
      </Section>
    </main>
  );
}
