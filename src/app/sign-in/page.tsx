import type { Metadata } from "next";
import { signInDemo } from "@/app/actions";

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
      {error && (
        <p role="alert" className="mt-3 text-critical">
          Sign-in failed. The demo account may not be set up.
        </p>
      )}
    </main>
  );
}
