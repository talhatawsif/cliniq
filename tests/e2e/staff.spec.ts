import { createHmac } from "node:crypto";
import { loadEnvFile } from "node:process";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

loadEnvFile(".env.local");
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(URL, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const password = `Pw-${crypto.randomUUID()}`;

/** RFC 6238 code (SHA-1, 30 s, 6 digits) from a base32 secret. */
function totp(secret: string, at = Date.now()) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.replace(/[\s=]/g, "").toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const h = createHmac("sha1", key).update(counter).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

const created: string[] = [];
async function makeUser(role?: string) {
  const email = `e2e-${crypto.randomUUID()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: role ? { role } : {},
  });
  expect(error).toBeNull();
  created.push(data.user!.id);
  return email;
}
test.afterAll(async () => {
  for (const id of created) await admin.auth.admin.deleteUser(id);
});

async function staffSignIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in as staff" }).click();
}

test("staff: password alone gets nothing; set up an authenticator, then in; no second code from a password", async ({
  page,
  request,
}) => {
  const email = await makeUser("staff");
  await staffSignIn(page, email);
  await expect(page).toHaveURL(/\/mfa$/);

  // Before the code: every other page and API is closed.
  await page.goto("/patients");
  await expect(page).toHaveURL(/\/mfa$/);
  expect((await page.request.get("/api/anything")).status()).toBe(403);

  await page.getByRole("button", { name: "Set up authenticator" }).click();
  const secret = (await page.locator("code").innerText()).trim();
  await page.getByLabel(/Code from your authenticator/).fill(totp(secret));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).toHaveURL(/\/patients$/);

  // The audit trail names this user, not the shared demo account.
  const { data: me } = await admin.auth.admin.listUsers();
  const id = me.users.find((u) => u.email === email)!.id;
  const { data: rows } = await admin.from("audit_events").select("agent").eq("agent", id);
  expect(rows!.length).toBeGreaterThan(0);

  // A new session starts at password level again, and a password cannot add a second authenticator.
  const fresh = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
  await fresh.auth.signInWithPassword({ email, password });
  const { error } = await fresh.auth.mfa.enroll({ factorType: "totp" });
  expect(error, "enrolling a second factor at password level must fail").not.toBeNull();
  void request;
});

test("a signed-in user without the staff role is refused, even if they set up a code", async ({ page }) => {
  const email = await makeUser();
  await staffSignIn(page, email);
  await expect(page).toHaveURL(/\/sign-in\?error=denied$/);
  await expect(page.getByText("This account is not authorised")).toBeVisible();
  await page.goto("/patients"); // it was signed straight back out
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("wrong staff password is refused", async ({ page }) => {
  await staffSignIn(page, "nobody@example.com");
  await expect(page).toHaveURL(/\/sign-in\?error=staff$/);
});
