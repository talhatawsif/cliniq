// Scores note extraction, assertion and top-1 coding against the owner's gold labels in eval/gold/*.json.
// Usage: npm run eval         (writes eval/REPORT.md; ignores any file whose labelledBy is empty)
//        npm run eval:draft   (writes unlabelled drafts to eval/gold/drafts/ for the owner to correct)
import { loadEnvFile } from "node:process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { it } from "vitest";
import targets from "../../services/nlp/targets.json";
import { codeTerm, type Config } from "../../src/lib/terminology/client";
import { type Assertion, type Span, ASSERTIONS, assertionOf, assertionScores, match, prf } from "./lib";

loadEnvFile(".env.local");
const DRAFT = process.env.EVAL_MODE === "draft";
const NOTES = "data/sample-notes";
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

type Gold = { file: string; labelledBy: string | null; labelledOn?: string; entities: Span[] };

it(DRAFT ? "write drafts" : "evaluate extraction", async () => {
  const { extractEntities } = await import("@/lib/nlp");
  const files = readdirSync(NOTES)
    .filter((f) => f.endsWith(".txt"))
    .sort();
  const predict = async (file: string) => {
    const text = readFileSync(`${NOTES}/${file}`, "utf8");
    const r = await extractEntities(text, file);
    return {
      text,
      engine: r.engine,
      spans: r.entities.map((e): Span => ({
        start: e.start,
        end: e.end,
        text: e.text,
        assertion: assertionOf(e),
      })),
    };
  };

  if (DRAFT) {
    mkdirSync("eval/gold/drafts", { recursive: true });
    for (const file of files) {
      const { spans } = await predict(file);
      const draft = {
        file,
        labelledBy: null,
        labelledOn: null,
        note: "DRAFT from the pipeline, not gold. Correct it, set labelledBy, move it to eval/gold/.",
        entities: spans.map((s) => ({ ...s, snomed: null })),
      };
      writeFileSync(
        `eval/gold/drafts/${file.replace(/\.txt$/, ".json")}.draft`.replace(/\.json\.draft$/, ".draft.json"),
        JSON.stringify(draft, null, 2) + "\n",
      );
    }
    return;
  }

  const gold = readdirSync("eval/gold")
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(`eval/gold/${f}`, "utf8")) as Gold)
    .filter((g) => g.labelledBy);
  const today = new Date().toISOString().slice(0, 10);

  if (!gold.length) {
    writeFileSync(
      "eval/REPORT.md",
      `# Extraction evaluation (${today})

**N = 0 notes.** There are no gold labels yet, so no numbers are reported. Labels must come from a person who has read the notes;
none are fabricated. See \`eval/gold/README.md\`: run \`npm run eval:draft\`, correct the drafts, set \`labelledBy\`, move them to
\`eval/gold/\`, then run \`npm run eval\` again.
`,
    );
    console.log("No gold labels: wrote an N = 0 report");
    return;
  }

  const cfg: Config = {
    backend: "csiro",
    base: process.env.TERMINOLOGY_BASE_URL ?? "https://tx.ontoserver.csiro.au/fhir",
  };
  let tp = 0,
    fp = 0,
    fn = 0;
  const allMatched: { gold: Span; predicted: Span }[] = [];
  const perNote: string[] = [];
  const errors: string[] = [];
  let codeTotal = 0,
    codeRight = 0,
    edition = "unknown";
  const engines = new Set<string>();
  for (const g of gold) {
    const { spans, engine } = await predict(g.file);
    engines.add(engine);
    const m = match(g.entities, spans);
    tp += m.matched.length;
    fp += m.spurious.length;
    fn += m.missed.length;
    allMatched.push(...m.matched);
    const n = prf(m.matched.length, m.spurious.length, m.missed.length);
    perNote.push(
      `| ${g.file} | ${g.entities.length} | ${spans.length} | ${pct(n.precision)} | ${pct(n.recall)} | ${pct(n.f1)} |`,
    );
    for (const s of m.spurious) errors.push(`- ${g.file}: extra "${s.text}" (${s.assertion})`);
    for (const s of m.missed) errors.push(`- ${g.file}: missed "${s.text}" (${s.assertion})`);
    for (const pair of m.matched) {
      if (pair.gold.assertion !== pair.predicted.assertion)
        errors.push(
          `- ${g.file}: "${pair.gold.text}" labelled ${pair.gold.assertion}, predicted ${pair.predicted.assertion}`,
        );
      if (pair.gold.assertion === "affirmed" && pair.gold.snomed) {
        const c = await codeTerm(pair.predicted.text, cfg, targets.targets);
        edition = c.edition ?? edition;
        codeTotal++;
        if (c.best?.code === pair.gold.snomed) codeRight++;
        else
          errors.push(
            `- ${g.file}: "${pair.gold.text}" expected ${pair.gold.snomed}, coded ${c.best?.code ?? "no code"}`,
          );
      }
    }
  }
  const overall = prf(tp, fp, fn);
  const a = assertionScores(allMatched);
  const accuracy = allMatched.length
    ? allMatched.filter((m) => m.gold.assertion === m.predicted.assertion).length / allMatched.length
    : 0;
  const labellers = [...new Set(gold.map((g) => g.labelledBy))].join(", ");
  writeFileSync(
    "eval/REPORT.md",
    `# Extraction evaluation (${today})

- **N = ${gold.length} notes** (of ${files.length}), labelled by ${labellers}.
- Extraction: ${[...engines].join(", ")}. Coding: ${cfg.backend} terminology server, ${edition}.
- Matching: a predicted span matches a gold span when their overlap is at least half of their union.

## Extraction (does it find the mentions)

| Precision | Recall | F1 | TP | FP | FN |
|---|---|---|---|---|---|
| ${pct(overall.precision)} | ${pct(overall.recall)} | ${pct(overall.f1)} | ${tp} | ${fp} | ${fn} |

## Assertion (is the mention affirmed, negated, family, historical, hypothetical or uncertain), over matched mentions

Overall assertion accuracy: ${pct(accuracy)} (${allMatched.length} matched).

| Assertion | Precision | Recall | F1 | Gold count |
|---|---|---|---|---|
${ASSERTIONS.map((t: Assertion) => `| ${t} | ${pct(a[t].precision)} | ${pct(a[t].recall)} | ${pct(a[t].f1)} | ${a[t].tp + a[t].fn} |`).join("\n")}

## Coding (top-1 SNOMED CT code, affirmed matched mentions with a gold code)

${codeTotal ? `${codeRight} of ${codeTotal} correct (${pct(codeRight / codeTotal)}).` : "No gold codes were provided."}

## Per note

| Note | Gold | Predicted | Precision | Recall | F1 |
|---|---|---|---|---|---|
${perNote.join("\n")}

## Every error

${errors.join("\n") || "None."}
`,
  );
  console.log(`N=${gold.length} F1=${pct(overall.f1)}`);
});
