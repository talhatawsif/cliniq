// Creates a staff account: node --env-file=.env.local scripts/create-staff.ts someone@example.org
// Prints a one-time password. The person sets up an authenticator app at first sign-in (/mfa).
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
if (!email?.includes("@")) throw new Error("usage: create-staff.ts <email>");
const password = randomBytes(18).toString("base64url");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
const { error } = await db.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  app_metadata: { role: "staff" }, // only the service key can set this; the app refuses accounts without it
});
if (error) throw error;
console.log(`created ${email}\npassword (shown once): ${password}`);
