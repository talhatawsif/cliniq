import type { Metadata } from "next";
import { signInDemo, signInStaff } from "@/app/actions";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignIn({ searchParams }: PageProps<"/sign-in">) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
      <h1 className="mb-2 text-xl font-semibold">Sign in</h1>
      <p className="mb-4 text-muted">
        ClinIQ is a prototype with synthetic data only. Sign in as the shared demo clinician. Your views are
        recorded in the audit log.
      </p>
      <form action={signInDemo}>
        <button type="submit" className="h-9 rounded border border-line-strong bg-surface px-4 font-semibold">
          Sign in as demo clinician
        </button>
      </form>
      <h2 className="mb-2 mt-8 text-base font-semibold">Staff sign-in</h2>
      <p className="mb-3 text-muted">
        For named accounts: email, password and a code from your authenticator app. Accounts are created by the
        project owner.
      </p>
      <form action={signInStaff} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          Email
          <input
            name="email"
            type="email"
            autoComplete="username"
            required
            className="h-9 rounded border border-line-strong bg-surface px-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="h-9 rounded border border-line-strong bg-surface px-2"
          />
        </label>
        <button
          type="submit"
          className="h-9 self-start rounded border border-line-strong bg-surface px-4 font-semibold"
        >
          Sign in as staff
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-3 text-critical">
          {error === "config"
            ? "Sign-in is not configured: set the Supabase keys and the demo clinician account (see docs/DEPLOY.md)."
            : error === "staff"
              ? "Email or password not accepted."
              : error === "denied"
                ? "This account is not authorised for ClinIQ."
                : "Sign-in failed. The demo account may not be set up."}
        </p>
      )}
    </main>
  );
}
