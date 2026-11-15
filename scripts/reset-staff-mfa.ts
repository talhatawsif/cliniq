// For someone who lost their authenticator: node --env-file=.env.local scripts/reset-staff-mfa.ts someone@example.org
// Removes their authenticator; at the next sign-in they set up a new one (/mfa). Check who is asking before you run it.
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
if (!email?.includes("@")) throw new Error("usage: reset-staff-mfa.ts <email>");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
// shortcut: first 1000 users only; this project has a handful of accounts.
const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
if (error) throw error;
const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) throw new Error(`no account for ${email}`);
const { data: factors, error: listError } = await db.auth.admin.mfa.listFactors({ userId: user.id });
if (listError) throw listError;
for (const f of factors.factors) {
  const { error: delError } = await db.auth.admin.mfa.deleteFactor({ userId: user.id, id: f.id });
  if (delError) throw delError;
}
console.log(`removed ${factors.factors.length} authenticator(s) for ${email}`);
