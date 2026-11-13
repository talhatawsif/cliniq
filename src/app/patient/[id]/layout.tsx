import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import FhirNotice from "@/components/FhirNotice";
import { JsonDrawerProvider } from "@/components/JsonDrawer";
import { smartSession } from "@/lib/smart/session";
import {
  FhirError,
  allergyStatus,
  banner,
  codeableText,
  getAllergies,
  getConditions,
  getPatient,
  problemList,
} from "@/lib/fhir";

export default async function PatientLayout({ children, params }: LayoutProps<"/patient/[id]">) {
  await connection();
  const { id } = await params;
  const smart = await smartSession();
  if (smart && smart.patient !== id) notFound(); // the launch selected one patient
  let data;
  try {
    const patient = await getPatient(id);
    if (!patient) notFound();
    data = { patient, allergies: await getAllergies(id), conditions: await getConditions(id) };
  } catch (e) {
    if (e instanceof FhirError) return <FhirNotice error={e} />;
    throw e;
  }
  const b = banner(data.patient);
  const state = allergyStatus(data.allergies);
  const listed = data.allergies.filter((a) => a.verificationStatus?.coding?.[0]?.code !== "entered-in-error");
  const activeCount = problemList(data.conditions).active.length;
  const line = `${b.family}, ${b.given} · DOB ${b.dob} (${b.status}) · ${b.sex} · IHI ${b.ihi ?? "not recorded"}`;

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
          {state === "listed" ? (
            <span className="text-critical">
              ▲ Allergies:{" "}
              {listed
                .map(
                  (a) =>
                    `${codeableText(a.code, "Unknown allergen")}${a.criticality ? ` (${a.criticality})` : ""}`,
                )
                .join(" · ")}
            </span>
          ) : (
            <span className="text-muted">
              {state === "no-known" ? "No known allergies" : "No allergies recorded"}
            </span>
          )}
          <span className="text-muted">
            {" · "}
            {activeCount} active {activeCount === 1 ? "problem" : "problems"}
          </span>
        </p>
      </div>
      <div className="flex flex-1 flex-col md:flex-row">
        <nav
          aria-label="Chart sections"
          className="border-b border-line p-4 md:w-44 md:shrink-0 md:border-b-0 md:border-r"
        >
          <ul className="flex flex-wrap gap-x-4 gap-y-1 md:flex-col">
            <li>
              <Link href={`/patient/${id}`}>Summary</Link>
            </li>
            <li>
              <Link href={`/patient/${id}/pathology`}>Pathology</Link>
            </li>
            <li>
              <Link href={`/patient/${id}/vitals`}>Vitals</Link>
            </li>
            <li>
              <Link href={`/patient/${id}/summary`}>Export summary</Link>
            </li>
            <li className="md:mt-3">
              <Link href="/patients">All patients</Link>
            </li>
          </ul>
        </nav>
        <JsonDrawerProvider banner={line}>
          <main className="min-w-0 flex-1 p-4 xl:p-6">{children}</main>
        </JsonDrawerProvider>
      </div>
    </>
  );
}
