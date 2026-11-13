import Link from "next/link";
import { notFound } from "next/navigation";
import FhirNotice from "@/components/FhirNotice";
import VitalsChart from "@/components/VitalsChart";
import { FhirError, codeableText, formatDate, getPatientDetail, humanName, quantityText } from "@/lib/fhir";

export default async function PatientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let detail;
  try {
    detail = await getPatientDetail(id);
  } catch (e) {
    if (e instanceof FhirError) return <FhirNotice error={e} />;
    throw e;
  }
  if (!detail) notFound();
  const { patient, observations, conditions, allergies } = detail;

  return (
    <main className="p-8 max-w-3xl mx-auto">
      <Link href="/" className="text-blue-600 text-sm">
        &larr; Back to patients
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-6">{humanName(patient.name)}</h1>
      <p className="text-sm text-gray-500 mb-6">
        DOB: {formatDate(patient.birthDate)} · Gender: {patient.gender ?? "not recorded"}
      </p>

      {allergies.length > 0 && (
        <section className="mb-6">
          <h2 className="font-semibold text-red-700 mb-2">⚠ Allergies</h2>
          <ul className="space-y-1">
            {allergies.map((a) => (
              <li key={a.id} className="bg-red-50 border border-red-200 rounded p-2 text-sm">
                {codeableText(a.code, "Unknown allergen")}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-6">
        <h2 className="font-semibold mb-2">Active Conditions</h2>
        <ul className="space-y-1">
          {conditions.map((c) => (
            <li key={c.id} className="border rounded p-2 text-sm">
              {codeableText(c.code, "Unknown condition")}
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="font-semibold mb-2">Vitals & Lab Trends</h2>
        <VitalsChart observations={observations} />
      </section>

      <section>
        <h2 className="font-semibold mb-2">Recent Observations</h2>
        <ul className="space-y-1">
          {observations.map((o) => (
            <li key={o.id} className="border rounded p-2 text-sm">
              {codeableText(o.code)}: {quantityText(o.valueQuantity)}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
