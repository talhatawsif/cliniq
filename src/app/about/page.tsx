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

      <Section title="How a note becomes FHIR">
        <p>
          A clinical note goes through rule-based language processing (sections, negation, family history,
          uncertainty), then a SNOMED CT-AU search, then FHIR validation. Only affirmed findings are written,
          as <em>unconfirmed</em> Conditions with Provenance. A clinician confirms, changes the code, or
          rejects each one in the review queue. No language model is involved in extraction, coding or
          writing.
        </p>
      </Section>

      <Section title="Evaluation">
        <ul className="list-disc pl-5">
          <li>
            Extraction context rules: 16 of 16 acceptance sentences pass (negation, family, historical,
            uncertain, hypothetical).
          </li>
          <li>
            Coding: 12 of 12 acceptance terms and their abbreviations return the expected SNOMED CT code on
            the live terminology server, and a nonsense term returns no code.
          </li>
          <li>
            Extraction precision, recall and F1 on the sample notes: not yet measured. It needs gold labels
            written by a person who has read the notes, and none have been supplied or invented.
          </li>
          <li>Chart assistant: measured on 20 questions; the report states what passed and what did not.</li>
          <li>
            The hazard log (17 hazards, each pointing to a test or control) and the architecture decision
            records are in the repository under docs/.
          </li>
        </ul>
      </Section>

      <Section title="Standards and versions">
        <ul className="list-disc pl-5">
          <li>FHIR R4 on HAPI FHIR 8.12; cohort resources validated against AU Core 2.0.0</li>
          <li>IHI identifiers (reserved test values), LOINC, UCUM</li>
          <li>
            SNOMED CT-AU for coding (CSIRO Ontoserver test endpoint, or NCTS with credentials), with an
            offline subset when neither is reachable. SNOMED CT® is a registered trademark of SNOMED
            International.
          </li>
          <li>HL7 v2.4 ORU^R01 in the style of Australian pathology (AS 4700.2)</li>
          <li>
            Auto-extracted findings are written as unconfirmed Conditions with Provenance and wait for
            clinician review
          </li>
          <li>SMART on FHIR launch (standalone and EHR, PKCE), read-only, from the SMART sandbox</li>
          <li>AU Patient Summary 1.0.0 export as a FHIR document Bundle</li>
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
          <li>Not built yet: n8n workflows and the extraction evaluation report.</li>
          <li>ICD-10-AM mapping needs an IHACPA licence, so it is not included.</li>
          <li>
            The chart assistant sends one patient&rsquo;s record facts to a free OpenRouter model (prompts
            leave Australia and free endpoints may keep them, which is why it is demo-only). Advice requests
            are refused, common questions are answered without a model, and every model sentence must cite the
            record or it is removed. It can be unavailable when the free daily limit is used up.
          </li>
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
