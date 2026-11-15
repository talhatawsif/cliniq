"use server";
import { redirect } from "next/navigation";
import { access } from "@/lib/access";
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

/** Staff: email and password first; the authenticator code is asked for on /mfa (the proxy enforces it). */
export async function signInStaff(formData: FormData) {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || !env.SUPABASE_SECRET_KEY)
    redirect("/sign-in?error=config");
  const supabase = await sessionClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (error) {
    await audit("sign-in", null, "staff sign-in failed", "failure", "anonymous");
    redirect("/sign-in?error=staff");
  }
  // A valid account that is not staff (an open sign-up) is signed straight back out.
  const { data } = await supabase.auth.getClaims();
  if (!data || access(data.claims, env.DEMO_CLINICIAN_EMAIL) === "deny") {
    await supabase.auth.signOut();
    await audit("sign-in", null, "account is not authorised", "failure", "anonymous");
    redirect("/sign-in?error=denied");
  }
  redirect("/mfa");
}

export async function signOut() {
  await (await sessionClient()).auth.signOut();
  redirect("/sign-in");
}
