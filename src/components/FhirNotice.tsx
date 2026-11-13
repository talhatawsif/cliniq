import { FhirError } from "@/lib/fhir";

/** Plain-language state for a FHIR server that is not configured or not answering. */
export default function FhirNotice({ error }: { error: FhirError }) {
  const notConfigured = error.kind === "not-configured";
  return (
    <main className="p-4 xl:p-6">
      <div role="status" className="max-w-2xl rounded border border-line-strong bg-surface p-4">
        <p className="font-medium">
          {notConfigured ? "FHIR server not configured" : "The FHIR server is not responding"}
        </p>
        <p className="mt-1 text-muted">
          {notConfigured
            ? "Set FHIR_BASE_URL to the address of a FHIR R4 server to see patient records."
            : "It may be waking up, which can take up to two minutes. Reload the page to try again."}
        </p>
      </div>
    </main>
  );
}
