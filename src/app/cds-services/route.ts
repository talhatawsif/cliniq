import { CORS, preflight } from "@/lib/cds/http";
import { PREFETCH } from "@/lib/cds/prefetch";

export const OPTIONS = preflight;

export function GET() {
  return Response.json(
    {
      services: [
        {
          hook: "patient-view",
          id: "cliniq-patient-view",
          title: "ClinIQ patient summary",
          description:
            "eGFR category (CKD-EPI 2021), BMI and care gaps from the open patient's record. Synthetic-data demo; not for clinical use.",
          prefetch: PREFETCH,
        },
      ],
    },
    { headers: CORS },
  );
}
