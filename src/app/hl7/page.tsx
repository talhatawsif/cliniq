import { readFileSync, readdirSync } from "node:fs";
import type { Metadata } from "next";
import { connection } from "next/server";
import DataTable from "@/components/DataTable";
import { admin } from "@/lib/supabase";
import Hl7Form from "./Hl7Form";

export const metadata: Metadata = { title: "HL7 v2" };

export default async function Hl7Page() {
  await connection();
  const samples = readdirSync("data/hl7v2")
    .filter((f) => f.endsWith(".hl7"))
    .map((f) => ({ name: f, text: readFileSync(`data/hl7v2/${f}`, "utf8") }));
  const { data: log } = await admin()
    .from("hl7_messages")
    .select("id,received,control_id,message_type,status,outcome")
    .order("received", { ascending: false })
    .limit(20);
  return (
    <main className="flex-1 space-y-6 px-4 py-4 xl:px-6">
      <h1 className="text-xl font-semibold">HL7 v2 pathology results</h1>
      <p className="text-muted">
        Paste or pick an ORU^R01 message. A dry run parses, maps to FHIR and validates; unticking it writes
        the results to the patient found by IHI. Patients are never created.
      </p>
      <Hl7Form samples={samples} />
      <section aria-labelledby="log-h">
        <h2 id="log-h" className="mb-2 text-base font-semibold">
          Message log (latest 20; failed messages stay here)
        </h2>
        <DataTable
          caption="HL7 message log"
          rows={log ?? []}
          rowKey={(r) => r.id}
          empty="No messages yet."
          columns={[
            {
              header: "Received",
              cell: (r) => new Date(r.received).toLocaleString("en-AU", { timeZone: "Australia/Sydney" }),
            },
            { header: "Control id", cell: (r) => <span className="font-mono">{r.control_id}</span> },
            { header: "Type", cell: (r) => r.message_type },
            {
              header: "Status",
              cell: (r) =>
                r.status === "failed" ? <span className="text-critical">▲ failed</span> : r.status,
            },
            { header: "Outcome", cell: (r) => r.outcome },
          ]}
        />
      </section>
    </main>
  );
}
