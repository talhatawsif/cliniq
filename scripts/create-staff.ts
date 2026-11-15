// Creates a named account: node --env-file=.env.local scripts/create-staff.ts someone@example.org [staff|viewer]
// "staff" can do everything; "viewer" is read-only. Prints a one-time password. The person sets up an
// authenticator app at first sign-in (/mfa).
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const [email, role = "staff"] = process.argv.slice(2);
if (!email?.includes("@") || !["staff", "viewer"].includes(role))
  throw new Error("usage: create-staff.ts <email> [staff|viewer]");
const password = randomBytes(18).toString("base64url");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
const { error } = await db.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  app_metadata: { role }, // only the service key can set this; the app refuses accounts without it
});
if (error) throw error;
console.log(`created ${email} (${role})\npassword (shown once): ${password}`);
