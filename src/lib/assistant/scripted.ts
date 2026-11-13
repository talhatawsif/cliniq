// Deterministic answers for the common questions: no model, every sentence cites the facts it comes from.
import type { Fact } from "./facts";
import type { Sentence } from "./filter";

// Common ways to name a test that differ from the record's name.
const ALIASES: Record<string, string[]> = {
  "glomerular filtration rate": ["egfr", "gfr"],
  "blood pressure": ["bp"],
  "body mass index (bmi)": ["bmi", "body mass index"],
  "body weight": ["weight"],
  "body height": ["height"],
  hemoglobin: ["haemoglobin", "hb"],
  "hemoglobin a1c/hemoglobin.total": ["hba1c", "a1c", "glycated haemoglobin", "glycated hemoglobin"],
  "cholesterol in hdl": ["hdl"],
  "cholesterol in ldl": ["ldl"],
  "urea nitrogen": ["urea"],
  "alanine aminotransferase": ["alt"],
  "aspartate aminotransferase": ["ast"],
  "bilirubin.total": ["bilirubin"],
  leukocytes: ["wcc", "white cell count", "white blood cell count"],
  hematocrit: ["haematocrit"],
};

export type Scripted = { intent: string; sentences: Sentence[] };

const lines = (facts: Fact[], kind: string, empty: string, prefix: string): Sentence[] => {
  const hits = facts.filter((f) => f.kind === kind);
  return hits.length
    ? hits.map((f) => ({ text: f.text.replace(new RegExp(`^${prefix}:\\s*`), ""), ids: [f.id] }))
    : [{ text: empty, ids: [] }];
};

/** Suggested questions: the intents below, so the default experience is instant and free. */
export const SUGGESTIONS = [
  "Active problems",
  "Current medicines",
  "Allergies",
  "Last encounter",
  "Immunisations",
];

export function scripted(question: string, facts: Fact[]): Scripted | null {
  const q = question.toLowerCase();
  if (/allerg/.test(q)) {
    const none = facts.find((f) => f.kind === "Allergy" && f.resource === null);
    return {
      intent: "allergies",
      sentences: none
        ? [{ text: "No allergies are recorded for this patient.", ids: [none.id] }]
        : lines(facts, "Allergy", "No allergies are recorded.", "Allergy"),
    };
  }
  if (/immunis|immuniz|vaccin/.test(q)) {
    // "Has she had a COVID vaccine?" lists only the matching vaccines; a general question lists them all.
    const GENERIC = new Set(
      "immunisation immunization vaccination vaccine vaccinations vaccines immunisations have been had has does patient recorded given received which what when this that with list show she her his they are the was were".split(
        " ",
      ),
    );
    const words = q.match(/[a-z0-9-]{3,}/g)?.filter((w) => !GENERIC.has(w)) ?? [];
    const hits = facts.filter(
      (f) => f.kind === "Immunisation" && words.some((w) => f.text.toLowerCase().includes(w)),
    );
    return {
      intent: "immunisations",
      sentences: hits.length
        ? hits.map((f) => ({ text: f.text.replace(/^Immunisation:\s*/, ""), ids: [f.id] }))
        : lines(facts, "Immunisation", "No immunisations are recorded.", "Immunisation"),
    };
  }
  if (/medic|medicine|drug|tablet|taking/.test(q))
    return {
      intent: "medicines",
      sentences: lines(facts, "Medicine", "No active medicines are recorded.", "Medicine"),
    };
  if (
    /(last|latest|most recent|previous)\s+(visit|encounter|appointment|consult)|when was .*(seen|last)/.test(
      q,
    )
  ) {
    const e = facts.find((f) => f.kind === "Encounter");
    return {
      intent: "last encounter",
      sentences: e
        ? [{ text: e.text.replace(/^Encounter:\s*/, "Most recent encounter: "), ids: [e.id] }]
        : [{ text: "No encounters are recorded.", ids: [] }],
    };
  }
  // A named test: the longest test name (or alias) in the question wins. Within a test, only facts with the same code.
  const results = facts.filter((f) => f.kind === "Result" && f.name);
  const named = [...new Set(results.map((f) => f.name!))]
    .filter(
      (n) =>
        q.includes(n.toLowerCase()) ||
        (ALIASES[n.toLowerCase()] ?? []).some((a) => new RegExp(`\\b${a}\\b`).test(q)),
    )
    .sort((a, b) => b.length - a.length)[0];
  if (named) {
    const same = results.filter((f) => f.name === named);
    const [latest, previous] = same.filter((f) => f.analyte === same[0].analyte); // newest first
    return {
      intent: "latest result",
      sentences: [
        { text: `Latest ${latest.text.replace(/^Result:\s*/, "")}`, ids: [latest.id] },
        ...(previous
          ? [{ text: `Before that: ${previous.text.replace(/^Result:\s*/, "")}`, ids: [previous.id] }]
          : []),
      ],
    };
  }
  if (/\b(problems?|diagnos[ie]s|conditions?)\b/.test(q))
    return {
      intent: "problems",
      sentences: lines(facts, "Condition", "No problems are recorded.", "Condition"),
    };
  return null;
}
