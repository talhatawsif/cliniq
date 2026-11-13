"use server";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import { sessionClient } from "@/lib/supabase";

/** One click, no typing: signs in the shared demo clinician account. */
export async function signInDemo() {
  const supabase = await sessionClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: env.DEMO_CLINICIAN_EMAIL ?? "",
    password: env.DEMO_CLINICIAN_PASSWORD ?? "",
  });
  if (error) redirect("/sign-in?error=1");
  await audit("sign-in", null);
  redirect("/patients");
}

export async function signOut() {
  await (await sessionClient()).auth.signOut();
  redirect("/sign-in");
}
