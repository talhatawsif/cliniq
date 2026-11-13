"use client";
import { useActionState, useState, useTransition } from "react";
import { type State, sendHl7 } from "./actions";

const show = (m: string) => m.replace(/\r\n|\r/g, "\n");

export default function Hl7Form({ samples }: { samples: { name: string; text: string }[] }) {
  const [, startTransition] = useTransition();
  const [state, action, pending] = useActionState<State, FormData>(sendHl7, null);
  const [text, setText] = useState(show(samples[0]?.text ?? ""));
  // A fresh control id each time a sample is picked, so repeat sends are not treated as duplicates.
  const pick = (name: string) => {
    const s = samples.find((x) => x.name === name);
    if (s)
      setText(
        show(s.text).replace(/^(MSH(?:[^|\n]*\|){9})[^|\n]*/, `$1${Date.now().toString(36).toUpperCase()}`),
      );
  };
  const r = state?.result;
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
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-[13px]">
            Sample{" "}
            <select
              onChange={(e) => pick(e.target.value)}
              className="h-8 rounded border border-line-strong bg-surface px-2"
            >
              {samples.map((s) => (
                <option key={s.name}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className="text-[13px]">
            <input type="checkbox" name="dryRun" defaultChecked /> Dry run (validate, write nothing)
          </label>
          <button
            type="submit"
            disabled={pending}
            className="h-8 rounded border border-line-strong bg-surface px-3 font-semibold"
          >
            {pending ? "Sending…" : "Send"}
          </button>
        </div>
        <label className="block text-[13px]">
          HL7 v2 message
          <textarea
            name="message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={9}
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
        <div className="space-y-4" data-testid="hl7-result">
          <section aria-labelledby="ack-h">
            <h2 id="ack-h" className="mb-1 text-base font-semibold">
              ACK: {r.code} · {r.status}
            </h2>
            <p className="mb-1 text-muted">{r.outcome}</p>
            <pre className="machine overflow-x-auto p-2 font-mono text-[13px]" data-testid="ack">
              {show(r.ack)}
            </pre>
          </section>
          <section aria-labelledby="seg-h">
            <h2 id="seg-h" className="mb-1 text-base font-semibold">
              Parsed segments
            </h2>
            <pre className="machine overflow-x-auto p-2 font-mono text-[13px]">
              {r.segments
                .map(
                  (s) =>
                    `${s.name}\n${s.fields
                      .map((f, i) => (f ? `  ${s.name}-${i + 1}: ${f}` : ""))
                      .filter(Boolean)
                      .join("\n")}`,
                )
                .join("\n")}
            </pre>
          </section>
          {r.validation && (
            <section aria-labelledby="val-h">
              <h2 id="val-h" className="mb-1 text-base font-semibold">
                Validation
              </h2>
              <p>{r.validation.length ? r.validation.join("; ") : "No errors from $validate."}</p>
            </section>
          )}
          {r.bundle && (
            <section aria-labelledby="b-h">
              <h2 id="b-h" className="mb-1 text-base font-semibold">
                FHIR Bundle
              </h2>
              <pre className="machine max-h-96 overflow-auto p-2 font-mono text-[13px]">
                {JSON.stringify(r.bundle, null, 2)}
              </pre>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
