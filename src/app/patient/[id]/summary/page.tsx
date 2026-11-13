import type { Composition } from "fhir/r4";
import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import FhirNotice from "@/components/FhirNotice";
import { auditChartView } from "@/lib/audit";
import { FhirError } from "@/lib/fhir";
import { loadSummary } from "@/lib/ps/load";

export const metadata: Metadata = { title: "Patient summary" };

export default async function SummaryPage({ params }: PageProps<"/patient/[id]/summary">) {
  await connection();
  const { id } = await params;
  let bundle;
  try {
    bundle = await loadSummary(id);
  } catch (e) {
    if (e instanceof FhirError) return <FhirNotice error={e} />;
    throw e;
  }
  if (!bundle) notFound();
  await auditChartView(id, "patient-summary");
  const composition = bundle.entry?.[0]?.resource as Composition;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-xl font-semibold">{composition.title}</h1>
        <span className="text-[13px] text-muted">
          AU Patient Summary 1.0.0 · confirmed, active data only · generated {composition.date.slice(0, 10)}
        </span>
        <a href={`/patient/${id}/summary.json`} download className="text-[13px]">
          Download FHIR JSON
        </a>
      </div>
      {composition.section?.map((s) => (
        <section key={s.title} className="mb-6">
          <h2 className="mb-2 text-base font-semibold">{s.title}</h2>
          {/* Narrative comes from the Bundle; build.ts escapes every value in it. */}
          <div className="ps-narrative" dangerouslySetInnerHTML={{ __html: s.text?.div ?? "" }} />
        </section>
      ))}
    </>
  );
}
