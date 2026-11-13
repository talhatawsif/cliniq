import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import DataTable from "@/components/DataTable";
import FhirNotice from "@/components/FhirNotice";
import { FhirError, PAGE_SIZE, banner, formatDate, getPatientsPage, getWorklistExtras } from "@/lib/fhir";

export const metadata: Metadata = { title: "Patients" };

export default async function Patients({ searchParams }: PageProps<"/patients">) {
  await connection(); // patient data is read per request, never at build time
  const params = await searchParams;
  const q = (typeof params.q === "string" ? params.q : "").trim().slice(0, 100);
  const page = Math.max(1, Number(params.page) || 1);

  let result;
  let extras;
  try {
    result = await getPatientsPage(q, page);
    extras = await getWorklistExtras(result.patients.flatMap((p) => (p.id ? [p.id] : [])));
  } catch (e) {
    if (e instanceof FhirError) return <FhirNotice error={e} />;
    throw e;
  }
  const { patients, total } = result;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) => `/patients?${new URLSearchParams({ ...(q && { q }), page: String(p) })}`;

  return (
    <main className="p-4 xl:p-6">
      <h1 className="mb-3 text-xl font-semibold">Patients</h1>
      <p className="mb-3 text-[13px] text-muted">
        {q ? `${total} matching “${q}”` : `${total} patients`} · page {Math.min(page, pages)} of {pages}
      </p>
      <DataTable
        caption="Patients"
        rows={patients}
        rowKey={(p) => p.id ?? ""}
        empty={q ? "No patients match that search." : "No patients on this FHIR server."}
        columns={[
          {
            header: "Name",
            cell: (p) => {
              const b = banner(p);
              return (
                <Link href={`/patient/${p.id}`}>
                  {b.family}, {b.given}
                </Link>
              );
            },
          },
          {
            header: "DOB (age)",
            cell: (p) => {
              const b = banner(p);
              return `${b.dob} (${b.status})`;
            },
          },
          { header: "Sex", cell: (p) => <span className="capitalize">{banner(p).sex}</span> },
          { header: "IHI", mono: true, cell: (p) => banner(p).ihi ?? "—" },
          { header: "Active problems", align: "right", cell: (p) => extras?.get(p.id ?? "")?.active ?? "—" },
          { header: "Last encounter", cell: (p) => formatDate(extras?.get(p.id ?? "")?.lastEncounter) },
        ]}
      />
      <nav aria-label="Pages" className="mt-3 flex gap-4 text-[13px]">
        {page > 1 && <Link href={href(page - 1)}>Previous page</Link>}
        {page < pages && <Link href={href(page + 1)}>Next page</Link>}
      </nav>
    </main>
  );
}
