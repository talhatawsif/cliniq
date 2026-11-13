import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/** Service-role client: bypasses RLS. Server only; the only reader of audit_events and quotas. */
export const admin = () =>
  createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

/** Client bound to the visitor's session cookies (server components and actions). */
export async function sessionClient() {
  const jar = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          // Server components cannot set cookies; the proxy refreshes the session instead.
        }
      },
    },
  });
}

/** The signed-in user's id, or null. Verified against the JWT signing keys. */
export async function currentUserId() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return null; // not configured
  const { data } = await (await sessionClient()).auth.getClaims();
  return data?.claims.sub ?? null;
}
