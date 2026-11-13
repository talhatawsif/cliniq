"use client";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { type State, runNote } from "./actions";

type Sample = { id: string; title: string; patientId: string; text: string };

export default function PipelineForm({
  samples,
  patients,
}: {
  samples: Sample[];
  patients: { id: string; name: string }[];
}) {
  const [, startTransition] = useTransition();
  const [state, action, pending] = useActionState<State, FormData>(runNote, null);
  const [docId, setDocId] = useState(samples[0]?.id ?? "");
  const [text, setText] = useState(samples[0]?.text ?? "");
  const [patientId, setPatientId] = useState(samples[0]?.patientId ?? patients[0]?.id ?? "");
  const pick = (id: string) => {
    const s = samples.find((x) => x.id === id);
    setDocId(id);
    setText(s?.text ?? "");
    if (s) setPatientId(s.patientId);
  };
  const r = state?.result;
  const field = "h-8 rounded border border-line-strong bg-surface px-2";
  return (
    <div className="space-y-4">
      {/* Not action={...}: React 19 resets a form after its action, which put the note picker and the dry-run box back to their first values. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
          startTransition(() => action(data));
        }}
        className="space-y-2"
      >
        <input type="hidden" name="docId" value={docId} />
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-[13px]">
            Note{" "}
            <select value={docId} onChange={(e) => pick(e.target.value)} className={field}>
              {samples.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
              <option value="">Paste a note…</option>
            </select>
          </label>
          {!docId && (
            <label className="text-[13px]">
              Patient{" "}
              <select
                name="patientId"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className={field}
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="text-[13px]">
            <input type="checkbox" name="dryRun" defaultChecked /> Dry run (validate, write nothing)
          </label>
          <button
            type="submit"
            disabled={pending}
            className="h-8 rounded border border-line-strong bg-surface px-3 font-semibold"
          >
            {pending ? "Running…" : "Run"}
          </button>
        </div>
        <label className="block text-[13px]">
          Note text
          <textarea
            name="text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setDocId(""); // edited text is a new, pasted note
            }}
            rows={12}
            spellCheck={false}
            className="machine mt-1 w-full rounded border border-line-strong p-2 font-mono text-[13px]"
          />
        </label>
      </form>
      {state?.error && (
        <p role="alert" className="text-critical">
          {state.error}
        </p>
      )}
      {r && (
        <div className="space-y-4" data-testid="pipeline-result">
          <p className="text-muted">
            {r.dryRun
              ? "Dry run: nothing was written."
              : `${r.written.length} unconfirmed Condition(s) written.`}{" "}
            Engine: {r.engine}
            {r.written.length > 0 && (
              <>
                {" "}
                <Link href="/review">Review them</Link>
              </>
            )}
          </p>
          <section aria-labelledby="ents-h">
            <h2 id="ents-h" className="mb-1 text-base font-semibold">
              Entities
            </h2>
            <table className="w-full border-collapse border-y border-line bg-surface text-left">
              <thead className="bg-sunken text-xs text-muted">
                <tr>
                  <th className="h-8 px-3 font-medium">Text</th>
                  <th className="h-8 px-3 font-medium">Outcome</th>
                  <th className="h-8 px-3 font-medium">Code</th>
                </tr>
              </thead>
              <tbody>
                {r.entities.map((e, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="px-3 py-1">{e.text}</td>
                    <td className="px-3 py-1">
                      {e.outcome === "write"
                        ? e.conditionId
                          ? "Written, pending review"
                          : r.dryRun
                            ? "Would be written"
                            : "Written"
                        : `Not written: ${e.reason}`}
                    </td>
                    <td className="px-3 py-1 font-mono text-[13px]">
                      {e.code ? `${e.code.code} ${e.code.display} (${e.code.confidence})` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section aria-labelledby="steps-h">
            <h2 id="steps-h" className="mb-1 text-base font-semibold">
              Steps
            </h2>
            {r.steps.map((s) => (
              <details key={s.name} className="border-b border-line py-1">
                <summary className="cursor-pointer">
                  {s.name} · {s.ms} ms
                </summary>
                <pre className="machine max-h-72 overflow-auto p-2 font-mono text-[13px]">
                  {JSON.stringify(s.output, null, 2)}
                </pre>
              </details>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
