"use client";
import { useActionState } from "react";
import { type State, review } from "./actions";

type Alt = { code: string; display: string; confidence: number };
export type CardProps = {
  id: string;
  patient: string; // banner line: the wrong-patient guard
  before: string;
  span: string;
  after: string;
  code: string;
  display: string;
  confidence: number;
  rationale: string;
  alternatives: Alt[];
  engine: string;
};

export default function ReviewCard(p: CardProps) {
  const [state, action, pending] = useActionState<State, FormData>(review, null);
  const btn = "h-8 rounded border border-line-strong bg-surface px-3";
  return (
    <li className="border-b border-line bg-surface px-4 py-3" data-testid="review-item" data-item-id={p.id}>
      <p className="tabular text-[13px] font-semibold">{p.patient}</p>
      <p className="my-2 whitespace-pre-wrap text-[13px]">
        …{p.before}
        <mark className="bg-sunken px-0.5 font-semibold text-fg underline">{p.span}</mark>
        {p.after}…
      </p>
      <p>
        <span className="font-mono">{p.code}</span> {p.display} · confidence {p.confidence}
      </p>
      <p className="text-[13px] text-muted">
        {p.rationale} · {p.engine} · Auto-extracted, not yet verified by a clinician
      </p>
      <form action={action} className="mt-2 space-y-2">
        <input type="hidden" name="id" value={p.id} />
        {p.alternatives.length > 0 && (
          <fieldset className="text-[13px]">
            <legend className="text-muted">Alternatives (to change the code)</legend>
            {p.alternatives.map((a) => (
              <label key={a.code} className="mr-4 inline-block">
                <input type="radio" name="newCode" value={a.code} />{" "}
                <span className="font-mono">{a.code}</span> {a.display}
              </label>
            ))}
          </fieldset>
        )}
        <div className="flex gap-2">
          <button name="decision" value="confirm" disabled={pending} className={btn}>
            Confirm
          </button>
          <button
            name="decision"
            value="change"
            disabled={pending || p.alternatives.length === 0}
            className={btn}
          >
            Change to selected
          </button>
          <button name="decision" value="reject" disabled={pending} className={btn}>
            Reject
          </button>
        </div>
        {state?.error && (
          <p role="alert" className="text-critical">
            {state.error}
          </p>
        )}
        {state?.done && <p className="text-muted">Recorded: {state.done}.</p>}
      </form>
    </li>
  );
}
