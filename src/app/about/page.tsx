import type { Metadata } from "next";

export const metadata: Metadata = { title: "About" };

export default function About() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <h1 className="mb-2 text-xl font-semibold">About ClinIQ</h1>
      <p className="text-muted">
        A clinical coding and interoperability prototype. Every record is synthetic. It is not a medical
        device and must not be used for care.
      </p>
    </main>
  );
}
