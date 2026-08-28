import { getPatients } from "@/lib/fhir";
import Link from "next/link";

export default async function Home() {
  const patients = await getPatients();

  return (
    <main className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">ClinIQ — Patients</h1>
      <ul className="space-y-2">
        {patients.map((p: any) => (
          <li key={p.id} className="border rounded p-3 hover:bg-gray-50">
            <Link href={`/patient/${p.id}`}>
              <span className="font-medium">
                {p.name?.[0]?.given?.join(" ")} {p.name?.[0]?.family}
              </span>
              <span className="text-sm text-gray-500 ml-2">
                DOB: {p.birthDate}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
