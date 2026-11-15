import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/supabase";

const link = "inline-flex h-9 items-center rounded border border-line-strong bg-surface px-4 font-semibold";

export default async function Home() {
  if (await currentUserId()) redirect("/patients");
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <h1 className="mb-2 text-xl font-semibold">ClinIQ</h1>
      <p className="mb-4">
        Clinical notes and HL7 v2 pathology become coded, validated FHIR, with a clinician in the loop.
      </p>
      <p className="mb-4 text-muted">
        A portfolio prototype for Australian health interoperability: FHIR R4, AU Core, AU Patient Summary, HL7 v2,
        CDS Hooks, SMART on FHIR and SNOMED CT-AU. All data is synthetic. It is not a medical device.
      </p>
      <div className="flex gap-3">
        <Link href="/sign-in" className={link}>
          Sign in
        </Link>
        <Link href="/about" className={link}>
          About and limits
        </Link>
      </div>
    </main>
  );
}
