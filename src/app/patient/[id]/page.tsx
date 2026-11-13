import { getPatientDetail } from "@/lib/fhir";
import Link from "next/link";
import { notFound } from "next/navigation";
import VitalsChart from "@/components/VitalsChart";

export default async function PatientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getPatientDetail(id);
  if (!detail) notFound();
  const { patient, observations, conditions, allergies } = detail;

  return (
    <main className="p-8 max-w-3xl mx-auto">
      <Link href="/" className="text-blue-600 text-sm">&larr; Back to patients</Link>
      <h1 className="text-2xl font-bold mt-2 mb-6">
        {patient.name?.[0]?.given?.join(" ")} {patient.name?.[0]?.family}
      </h1>
      <p className="text-sm text-gray-500 mb-6">DOB: {patient.birthDate} · Gender: {patient.gender}</p>

      {allergies.length > 0 && (
        <section className="mb-6">
          <h2 className="font-semibold text-red-700 mb-2">⚠ Allergies</h2>
          <ul className="space-y-1">
            {allergies.map((a: any) => (
              <li key={a.id} className="bg-red-50 border border-red-200 rounded p-2 text-sm">
                {a.code?.text || a.code?.coding?.[0]?.display || "Unknown allergen"}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-6">
        <h2 className="font-semibold mb-2">Active Conditions</h2>
        <ul className="space-y-1">
          {conditions.map((c: any) => (
            <li key={c.id} className="border rounded p-2 text-sm">
              {c.code?.text || c.code?.coding?.[0]?.display || "Unknown condition"}
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
          {observations.map((o: any) => (
            <li key={o.id} className="border rounded p-2 text-sm">
              {o.code?.text || o.code?.coding?.[0]?.display || "Unknown"}:{" "}
              {o.valueQuantity ? `${o.valueQuantity.value} ${o.valueQuantity.unit || ""}` : "—"}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
