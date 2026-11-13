import Link from "next/link";
import { connection } from "next/server";
import FhirNotice from "@/components/FhirNotice";
import { FhirError, formatDate, getPatients, humanName } from "@/lib/fhir";

export default async function Home() {
  await connection(); // patient data is read per request, never at build time
  let patients;
  try {
    patients = await getPatients();
  } catch (e) {
    if (e instanceof FhirError) return <FhirNotice error={e} />;
    throw e;
  }

  return (
    <main className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">ClinIQ — Patients</h1>
      {patients.length === 0 && <p className="text-sm text-gray-600">No patients on this FHIR server.</p>}
      <ul className="space-y-2">
        {patients.map((p) => (
          <li key={p.id} className="border rounded p-3 hover:bg-gray-50">
            <Link href={`/patient/${p.id}`}>
              <span className="font-medium">{humanName(p.name)}</span>
              <span className="text-sm text-gray-500 ml-2">DOB: {formatDate(p.birthDate)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
