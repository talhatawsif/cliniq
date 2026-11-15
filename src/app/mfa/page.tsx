import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions";
import { sessionClient } from "@/lib/supabase";
import { MfaForm } from "./MfaForm";

export const metadata: Metadata = { title: "Authenticator code" };

export default async function Mfa() {
  const supabase = await sessionClient();
  const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (level?.currentLevel === "aal2") redirect("/patients");
  const { data } = await supabase.auth.mfa.listFactors();
  const factor = data?.totp.find((f) => f.status === "verified");
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
      <h1 className="mb-2 text-xl font-semibold">Authenticator code</h1>
      <MfaForm factorId={factor?.id ?? null} />
      <form action={signOut} className="mt-6">
        <button type="submit" className="text-muted underline">
          Sign out
        </button>
      </form>
    </main>
  );
}
