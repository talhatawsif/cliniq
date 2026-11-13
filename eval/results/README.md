# Raw evaluation data

One JSON object per line. Kept so the runs can be re-analysed later, compared with other models, or used as a small labelled
set for experiments (fine-tuning, prompt tuning, filter tuning). Everything here is about **synthetic** patients (Synthea,
Australianised). Nothing in it is real patient data.

| File | Written by | Contents |
|---|---|---|
| `llm-probe-<date>.jsonl` | `npm run llm:probe` | One line per free model: the exact prompt, the raw reply, pass/fail with the reasons, latency, reported cost, reasoning tokens |
| `assistant-<date>.jsonl` | `npm run assistant:eval` | One line per question: the question, the facts sent (with ids), the exact messages and raw model reply (`model_call`, null when no model was called), the final answer after the output filter, pass/fail and why, latency |
| `*.partial.jsonl` | converted by hand from the first runs on 13 Nov 2026 | Only what the report tables kept (no prompts, no raw replies); `"partial": true` |

Notes for anyone reusing this:

- Model replies come from OpenRouter free endpoints, whose providers may log prompts and apply their own terms. Check those
  terms before using the replies to train or distil a model.
- The labels are mechanical, not clinical: `pass` means "cited the expected fact" or "refused" or "did not leak", as defined in
  `eval/assistant/questions.json`. They are not clinician-reviewed.
- Free models change often; a result is a snapshot of that day.
- Do not add real patient data here.
