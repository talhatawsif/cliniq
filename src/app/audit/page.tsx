import type { Metadata } from "next";
import { connection } from "next/server";
import { z } from "zod";
import DataTable from "@/components/DataTable";
import { admin } from "@/lib/supabase";

export const metadata: Metadata = { title: "Audit log" };

const filters = z.object({
  action: z.enum(["view", "export", "write", "review", "sign-in"]).optional().catch(undefined),
  outcome: z.enum(["success", "failure"]).optional().catch(undefined),
  entity: z.string().trim().max(80).optional(),
});

export default async function Audit({ searchParams }: PageProps<"/audit">) {
  await connection();
  const f = filters.parse(
    Object.fromEntries(Object.entries(await searchParams).map(([k, v]) => [k, [v].flat()[0]])),
  );
  let query = admin().from("audit_events").select("*").order("recorded", { ascending: false }).limit(100);
  if (f.action) query = query.eq("action", f.action);
  if (f.outcome) query = query.eq("outcome", f.outcome);
  if (f.entity) query = query.eq("entity", f.entity);
  const { data, error } = await query;
  const field = "h-8 rounded border border-line-strong bg-surface px-2";
  return (
    <main className="flex-1 px-4 py-4 xl:px-6">
      <h1 className="mb-3 text-xl font-semibold">Audit log</h1>
      <form className="mb-3 flex flex-wrap items-end gap-3">
        <label className="text-[13px]">
          Action
          <select name="action" defaultValue={f.action ?? ""} className={`${field} ml-2`}>
            <option value="">All</option>
            {["view", "export", "write", "review", "sign-in"].map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className="text-[13px]">
          Outcome
          <select name="outcome" defaultValue={f.outcome ?? ""} className={`${field} ml-2`}>
            <option value="">All</option>
            <option>success</option>
            <option>failure</option>
          </select>
        </label>
        <label className="text-[13px]">
          Resource
          <input
            name="entity"
            defaultValue={f.entity ?? ""}
            placeholder="Patient/123"
            className={`${field} ml-2`}
          />
        </label>
        <button type="submit" className="h-8 rounded border border-line-strong bg-surface px-3">
          Filter
        </button>
      </form>
      {error ? (
        <p role="alert" className="text-critical">
          The audit log could not be read.
        </p>
      ) : (
        <DataTable
          caption="Audit events, newest first (up to 100)"
          rows={data ?? []}
          rowKey={(r) => r.id}
          empty="No audit events match."
          columns={[
            {
              header: "Time",
              cell: (r) => new Date(r.recorded).toLocaleString("en-AU", { timeZone: "Australia/Sydney" }),
            },
            { header: "Who", cell: (r) => <span className="font-mono">{String(r.agent).slice(0, 8)}</span> },
            { header: "Action", cell: (r) => r.action },
            { header: "Resource", cell: (r) => r.entity ?? "—" },
            { header: "Outcome", cell: (r) => r.outcome },
            { header: "Detail", cell: (r) => r.detail ?? "—" },
          ]}
        />
      )}
    </main>
  );
}
