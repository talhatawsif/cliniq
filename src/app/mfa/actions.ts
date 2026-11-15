"use server";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { sessionClient } from "@/lib/supabase";

/** Starts authenticator set-up. Refuses when a code is already set up, so a password alone cannot add a second one. */
export async function enrolTotp(): Promise<{ factorId: string; qr: string; secret: string } | { error: string }> {
  const supabase = await sessionClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  if (factors?.totp.some((f) => f.status === "verified")) return { error: "An authenticator is already set up." };
  for (const f of factors?.all ?? [])
    if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id }); // abandoned earlier attempts
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "ClinIQ" });
  if (error || !data) return { error: "Could not start set-up. Try again." };
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyTotp(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const supabase = await sessionClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: String(formData.get("factorId") ?? ""),
    code: String(formData.get("code") ?? "").trim(),
  });
  if (error) {
    await audit("sign-in", null, "authenticator code failed", "failure");
    return { error: "That code did not work. Wait for the next one and try again." };
  }
  await audit("sign-in", null, "authenticator code accepted");
  redirect("/patients");
}
