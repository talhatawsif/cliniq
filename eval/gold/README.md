# Gold labels for the extraction evaluation

`npm run eval` scores the note pipeline (extraction, assertion, coding) against the files in this folder. **The labels must be
yours** (or a clinician's), written from reading each note. Nobody else can supply them: a model's output is not a label.

## Steps

1. `npm run eval:draft` writes a draft for each of the 12 sample notes to `drafts/`, pre-filled from the current pipeline's
   output so you do not start from an empty file. A draft is **not** gold: its `labelledBy` is `null` and the evaluation ignores it.
2. Open a draft next to the note in `data/sample-notes/`. Read the whole note and correct the file:
   - delete every entity that is not a clinical condition, symptom or finding in the note;
   - add every one the pipeline missed (`start` and `end` are character offsets into the note text, `text` is exactly
     `note.slice(start, end)`);
   - set `assertion` to what the note says about it: `affirmed`, `negated`, `family`, `historical`, `hypothetical` or `uncertain`
     (if several apply, use the first of that list that applies after `affirmed`, in the order negated, family, hypothetical,
     uncertain, historical);
   - for an affirmed entity set `snomed` to the SNOMED CT code that fits it best (check it with `$lookup` on the terminology
     server), or `null` if there is none.
3. Set `"labelledBy"` to your name and `"labelledOn"` to the date, then move the file from `drafts/` to this folder.
4. `npm run eval` writes `eval/REPORT.md` with N, who labelled, and the numbers.

## Format

```json
{
  "file": "01-referral-nephrology.txt",
  "labelledBy": "Your Name",
  "labelledOn": "2026-11-20",
  "entities": [
    { "start": 52, "end": 55, "text": "HTN", "assertion": "affirmed", "snomed": "38341003" },
    { "start": 150, "end": 160, "text": "chest pain", "assertion": "negated", "snomed": null }
  ]
}
```
