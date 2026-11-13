import { auditChartView } from "@/lib/audit";
import DataTable from "@/components/DataTable";
import { JsonButton } from "@/components/JsonDrawer";
import TrendChart from "@/components/TrendChart";
import {
  buildTrends,
  codeableText,
  flagOf,
  formatDate,
  formatResult,
  getObservations,
  referenceText,
} from "@/lib/fhir";

/** Observations of one category: analyte list, trend charts, and every result in a table. */
export default async function ObservationsView({
  id,
  category,
  title,
}: {
  id: string;
  category: "laboratory" | "vital-signs";
  title: string;
}) {
  await auditChartView(id, category);
  const trends = buildTrends(await getObservations(id, category));
  const charted = trends.series.filter((s) => s.points.length >= 2);
  const slug = (k: string) => `s-${k.replace(/[^A-Za-z0-9]+/g, "-")}`;

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <nav aria-label={`${title} analytes`} className="lg:w-56 lg:shrink-0">
        <h2 className="mb-2 text-base font-semibold">{title}</h2>
        <ul className="space-y-1 text-[13px]">
          {trends.bp && (
            <li>
              <a href="#s-bp">Blood pressure</a>
            </li>
          )}
          {charted.map((s) => (
            <li key={s.key}>
              <a href={`#${slug(s.key)}`}>
                {s.label}
                {s.mixedUnits ? ` (${s.unit})` : ""}
              </a>
            </li>
          ))}
          {!trends.bp && charted.length === 0 && <li className="text-muted">Nothing to chart yet.</li>}
        </ul>
      </nav>
      <div className="min-w-0 flex-1">
        {trends.bp && (
          <div id="s-bp" className="scroll-mt-36">
            <TrendChart
              title="Blood pressure"
              unit="mmHg"
              lines={[
                {
                  name: "Systolic",
                  color: "var(--accent)",
                  points: trends.bp.systolic.map((p) => ({
                    t: p.t,
                    value: p.value,
                    abnormal: p.flag !== undefined,
                  })),
                },
                {
                  name: "Diastolic",
                  color: "var(--fg)",
                  points: trends.bp.diastolic.map((p) => ({
                    t: p.t,
                    value: p.value,
                    abnormal: p.flag !== undefined,
                  })),
                },
              ]}
            />
          </div>
        )}
        {charted.map((s) => (
          <div key={s.key} id={slug(s.key)} className="scroll-mt-36">
            {s.mixedUnits && (
              <p className="mb-1 text-[13px] text-warning">
                Mixed units: results in {s.unit} are shown separately and were not converted.
              </p>
            )}
            <TrendChart
              title={s.label}
              unit={s.unit}
              band={s.ref}
              lines={[
                {
                  name: s.label,
                  color: "var(--accent)",
                  points: s.points.map((p) => ({ t: p.t, value: p.value, abnormal: p.flag !== undefined })),
                },
              ]}
            />
          </div>
        ))}
        <h2 className="mb-2 text-base font-semibold">All results</h2>
        <DataTable
          caption={`${title} results`}
          rows={trends.included}
          rowKey={(o) => o.id ?? ""}
          empty={`No ${title.toLowerCase()} results recorded.`}
          columns={[
            { header: "Test", cell: (o) => codeableText(o.code) },
            { header: "Value", align: "right", cell: (o) => formatResult(o) },
            { header: "Reference range", cell: (o) => referenceText(o) },
            {
              header: "Flag",
              cell: (o) => {
                const f = flagOf(o);
                return f ? <span className="text-warning">{f === "Low" ? "Low ▼" : `${f} ▲`}</span> : "";
              },
            },
            { header: "Date", cell: (o) => formatDate(o.effectiveDateTime ?? o.effectivePeriod?.start) },
            { header: "Record", cell: (o) => <JsonButton resource={o} label={codeableText(o.code)} /> },
          ]}
        />
      </div>
    </div>
  );
}
