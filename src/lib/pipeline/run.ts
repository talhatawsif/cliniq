import "server-only";
import type { Bundle, Condition, DocumentReference } from "fhir/r4";
import { audit } from "@/lib/audit";
import { fhirFetch, fhirSearch, isFhirId } from "@/lib/fhir/client";
import { createdId, validateBundle, writeBundle } from "@/lib/fhir/write";
import { extractEntities } from "@/lib/nlp";
import { codeCondition } from "@/lib/terminology";
import { admin } from "@/lib/supabase";
import { TAGS, buildFinding, buildNote, findingKey, reasonNotWritten } from "./build";

export type Step = { name: string; ms: number; output: unknown };
export type EntityRow = {
  text: string;
  start: number;
  end: number;
  /** "write" means a Condition was (or, in a dry run, would be) created. */
  outcome: "write" | "skip";
  reason?: string;
  code?: { code: string; display: string; confidence: number };
  conditionId?: string;
};
export type RunResult = {
  dryRun: boolean;
  docId: string;
  patientId: string;
  engine: string;
  steps: Step[];
  entities: EntityRow[];
  written: { conditionId: string; code: string; display: string }[];
};

const SAMPLE_TAG = `${TAGS}|sample-note`;
const SNOMED = "http://snomed.info/sct";

export const noteText = (d: DocumentReference) =>
  Buffer.from(d.content[0]?.attachment?.data ?? "", "base64").toString("utf8");

export const listSampleNotes = () =>
  fhirSearch<DocumentReference>(
    `DocumentReference?_tag=${encodeURIComponent(SAMPLE_TAG)}&_count=50&_sort=_id`,
  );

/** Extract, code, build, validate and (unless a dry run) write unconfirmed Conditions from one note. */
export async function runPipeline(input: {
  docId?: string;
  patientId?: string;
  text?: string;
  dryRun: boolean;
  userId: string;
}): Promise<RunResult> {
  const steps: Step[] = [];
  const timed = async <T>(name: string, fn: () => Promise<T>, summarise: (r: T) => unknown = (r) => r) => {
    const t0 = performance.now();
    const result = await fn();
    steps.push({ name, ms: Math.round(performance.now() - t0), output: summarise(result) });
    return result;
  };
  const now = new Date();

  // 1. The note: an existing DocumentReference, or pasted text stored as one.
  const note = await timed(
    "Note",
    async () => {
      if (input.docId) {
        const doc = await fhirFetch<DocumentReference>(
          `DocumentReference/${encodeURIComponent(input.docId)}`,
        );
        if (!doc?.subject?.reference) throw new Error("Note not found");
        return { docId: doc.id!, patientId: doc.subject.reference.split("/")[1], text: noteText(doc) };
      }
      if (!input.patientId || !input.text?.trim())
        throw new Error("Pick a note, or paste text and choose a patient");
      if (!isFhirId(input.patientId) || !(await fhirFetch(`Patient/${input.patientId}`)))
        throw new Error("Unknown patient");
      const doc = buildNote(input.patientId, input.text, now);
      if (!input.dryRun) {
        await writeBundle({
          resourceType: "Bundle",
          type: "transaction",
          entry: [{ resource: doc, request: { method: "PUT", url: `DocumentReference/${doc.id}` } }],
        });
      }
      return { docId: doc.id!, patientId: input.patientId, text: input.text };
    },
    (n) => ({ docId: n.docId, patientId: n.patientId, characters: n.text.length }),
  );

  // 2. Extraction
  const noteFile = note.docId.startsWith("sample-") ? `${note.docId.slice("sample-".length)}.txt` : undefined;
  const extraction = await timed(
    "Extract",
    () => extractEntities(note.text, noteFile),
    (e) => e,
  );

  // 3. Which entities may go forward (affirmed only) and what is already on the chart
  const existing = await timed(
    "Problem list",
    () => fhirSearch<Condition>(`Condition?patient=${note.patientId}&_count=100`),
    (c) => ({ conditions: c.length }),
  );
  const rows: EntityRow[] = [];
  const claimed = new Set<string>();
  let engine =
    extraction.engine === "medspacy" ? "medspaCy" : `precomputed NLP output (${extraction.reason})`;

  // 4. Coding, one entity at a time
  const coded = await timed(
    "Code",
    async () => {
      const out: { row: EntityRow; coding?: Awaited<ReturnType<typeof codeCondition>> }[] = [];
      for (const e of extraction.entities) {
        const row: EntityRow = { text: e.text, start: e.start, end: e.end, outcome: "skip" };
        const why = reasonNotWritten(e);
        if (why) {
          rows.push({ ...row, reason: why });
          continue;
        }
        const coding = await codeCondition(e.text);
        engine = `${engine}; ${coding.backend} ${coding.edition ?? "unknown edition"}`;
        if (!coding.best) {
          rows.push({ ...row, reason: "no code found" });
          continue;
        }
        const { code, display, confidence } = coding.best;
        row.code = { code, display, confidence };
        const key = findingKey(note.docId, code);
        if (claimed.has(code)) row.reason = "same code already found in this note";
        else if (existing.some((c) => c.identifier?.some((i) => i.value === key)))
          row.reason = "already extracted from this note";
        else if (
          existing.some(
            (c) =>
              c.code?.coding?.some((x) => x.system === SNOMED && x.code === code) &&
              !["refuted", "entered-in-error"].includes(c.verificationStatus?.coding?.[0]?.code ?? ""),
          )
        ) {
          row.reason = "already on the problem list";
        } else row.outcome = "write";
        claimed.add(code);
        rows.push(row);
        out.push({ row, coding });
      }
      return out;
    },
    (o) =>
      o.map((x) => ({
        text: x.row.text,
        code: x.row.code?.code,
        alternatives: x.coding?.alternatives.length,
      })),
  );
  engine = [...new Set(engine.split("; "))].join("; ");

  // 5. Build, validate, write
  const written: RunResult["written"] = [];
  await timed(
    "Validate and write",
    async () => {
      const log: unknown[] = [];
      for (const { row, coding } of coded) {
        if (row.outcome !== "write" || !coding?.best) continue;
        const bundle: Bundle = buildFinding(
          { patientId: note.patientId, docId: note.docId, text: row.text, coding: coding.best },
          { version: engine },
          now,
        );
        const errors = await validateBundle(bundle);
        if (errors.length) {
          row.outcome = "skip";
          row.reason = `FHIR validation failed: ${errors[0]}`;
          log.push({ text: row.text, errors });
          continue;
        }
        if (input.dryRun) {
          log.push({ text: row.text, validated: true, written: false });
          continue;
        }
        const response = await writeBundle(bundle);
        const conditionId = createdId(response, 1);
        if (!conditionId) throw new Error("The server did not report the new Condition's id");
        row.conditionId = conditionId;
        written.push({ conditionId, code: coding.best.code, display: coding.best.display });
        const { error } = await admin().from("review_items").upsert(
          {
            patient_id: note.patientId,
            document_id: note.docId,
            condition_id: conditionId,
            term: row.text,
            span_start: row.start,
            span_end: row.end,
            code: coding.best.code,
            display: coding.best.display,
            confidence: coding.best.confidence,
            rationale: coding.best.rationale,
            alternatives: coding.alternatives,
            engine,
          },
          { onConflict: "condition_id", ignoreDuplicates: true },
        );
        if (error) throw new Error(`review queue write failed: ${error.code}`);
        await audit("write", `Condition/${conditionId}`, "auto-extracted Condition", "success", input.userId);
        log.push({ text: row.text, written: `Condition/${conditionId}` });
      }
      return log;
    },
    (l) => l,
  );

  return {
    dryRun: input.dryRun,
    docId: note.docId,
    patientId: note.patientId,
    engine,
    steps,
    entities: rows,
    written,
  };
}
