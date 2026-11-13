import { FhirError } from "@/lib/fhir";

/** Plain-language state for a FHIR server that is not configured or not answering. */
export default function FhirNotice({ error }: { error: FhirError }) {
  const notConfigured = error.kind === "not-configured";
  return (
    <main className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">ClinIQ</h1>
      <div role="status" className="border rounded p-4 text-sm">
        <p className="font-medium">
          {notConfigured ? "FHIR server not configured" : "The FHIR server is not responding"}
        </p>
        <p className="text-gray-600 mt-1">
          {notConfigured
            ? "Set FHIR_BASE_URL to the address of a FHIR R4 server to see patient records."
            : "It may be waking up, which can take up to two minutes. Reload the page to try again."}
        </p>
      </div>
    </main>
  );
}
