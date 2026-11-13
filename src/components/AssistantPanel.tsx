"use client";
import { useState } from "react";
import type { Resource } from "fhir/r4";
import { useJsonDrawer } from "@/components/JsonDrawer";

type Sentence = { text: string; ids: string[] };
type Citation = { id: string; label: string; resource: Resource | null };
type Reply = {
  kind: "refused" | "scripted" | "ai" | "no_answer" | "limit" | "unavailable" | "not_configured";
  sentences: Sentence[];
  removed: number;
  message?: string;
  model?: string;
  ms?: number;
  cached?: boolean;
  suggestions?: string[];
  citations: Citation[];
  remaining: number;
};

const SUGGESTED = ["Active problems", "Current medicines", "Allergies", "Last encounter", "Immunisations"];
const LIMIT = 40;

export default function AssistantPanel({ patientId, remaining }: { patientId: string; remaining: number }) {
  const openJson = useJsonDrawer();
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<Reply | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(remaining);

  async function ask(q: string) {
    if (!q.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/patients/${patientId}/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      if (!res.ok)
        throw new Error(res.status === 401 ? "Sign in required" : "The question could not be answered");
      const r = (await res.json()) as Reply;
      setReply(r);
      setLeft(r.remaining);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The question could not be answered");
    } finally {
      setBusy(false);
    }
  }

  const byId = new Map(reply?.citations.map((c) => [c.id, c]));
  const ai = reply?.kind === "ai";
  return (
    <div className="space-y-3" data-testid="assistant">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Suggested questions">
        {SUGGESTED.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => ask(s)}
            disabled={busy}
            className="h-8 rounded border border-line-strong bg-surface px-3 text-[13px]"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="flex gap-2"
      >
        <label className="sr-only" htmlFor="assistant-q">
          Ask a question about this record
        </label>
        <input
          id="assistant-q"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={500}
          placeholder="Ask a question about this record…"
          className="h-8 min-w-0 flex-1 rounded border border-line-strong bg-surface px-2 placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={busy || !question.trim()}
          className="h-8 rounded border border-line-strong bg-surface px-3 font-semibold"
        >
          Ask
        </button>
      </form>
      <p className="text-xs text-muted">
        Reports what is in the record. No advice. AI questions left today: {left} of {LIMIT}
      </p>

      <div aria-live="polite" className="min-h-6">
        {busy && <p className="text-muted">Thinking…</p>}
        {error && (
          <p role="alert" className="text-critical">
            {error}
          </p>
        )}
        {reply && !busy && (
          <div
            className={`border-l-2 pl-3 ${ai ? "machine border-line-strong" : "border-line"}`}
            data-testid="assistant-answer"
            data-kind={reply.kind}
          >
            <p className="text-xs text-muted">
              {ai
                ? "AI-generated — verify against the record"
                : reply.kind === "scripted"
                  ? "From the record"
                  : ""}
              {reply.cached ? " · cached" : ""}
            </p>
            {reply.message && <p>{reply.message}</p>}
            {reply.sentences.map((s, i) => (
              <p key={i} className="my-1">
                {s.text}{" "}
                {s.ids.map((id) => {
                  const c = byId.get(id);
                  return c?.resource ? (
                    <button
                      key={id}
                      type="button"
                      onClick={() => openJson(c.resource!)}
                      className="mr-1 rounded border border-line px-1 text-xs text-accent underline"
                      aria-label={`Open the record for ${c.label}`}
                    >
                      {id}
                    </button>
                  ) : (
                    <span key={id} className="mr-1 rounded border border-line px-1 text-xs text-muted">
                      {id}
                    </span>
                  );
                })}
              </p>
            ))}
            {reply.removed > 0 && (
              <p className="text-xs text-muted">
                {reply.removed} sentence{reply.removed > 1 ? "s" : ""} removed: not supported by the record.
              </p>
            )}
            {ai && reply.model && (
              <p className="text-xs text-muted">
                model: {reply.model} · {((reply.ms ?? 0) / 1000).toFixed(1)} s
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
