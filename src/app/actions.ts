"use server";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import { sessionClient } from "@/lib/supabase";

/** One click, no typing: signs in the shared demo clinician account. */
export async function signInDemo() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || !env.SUPABASE_SECRET_KEY)
    redirect("/sign-in?error=config");
  const supabase = await sessionClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: env.DEMO_CLINICIAN_EMAIL ?? "",
    password: env.DEMO_CLINICIAN_PASSWORD ?? "",
  });
  if (error) {
    await audit("sign-in", null, "demo sign-in failed", "failure", "anonymous");
    redirect("/sign-in?error=1");
  }
  await audit("sign-in", null);
  redirect("/patients");
}

export async function signOut() {
  await (await sessionClient()).auth.signOut();
  redirect("/sign-in");
}
