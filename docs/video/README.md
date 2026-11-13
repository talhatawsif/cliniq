# Demo recordings

Recorded by Playwright against the deployed app, with an on-screen cursor and captions (no audio):

- `cliniq-demo.webm` (about 3.5 minutes): sign-in, worklist, chart, decision support, assistant (cited answers, refused advice),
  pathology and vitals trends, AU Patient Summary export, note to coded FHIR with the review queue, HL7 v2 in, and the About page.
- `cliniq-n8n.webm` (about 1.5 minutes): the two n8n workflows (the exported graphs) and real runs: an HL7 message accepted and
  filed in `done/`, a message for an unknown patient retried three times and filed in `failed/` with a notice, and the care-gap
  sweep run twice (Tasks created once). The n8n editor itself needs the owner's login, so it is not shown.

The files are not in git (about 25 MB). Re-record with `npx playwright test -c playwright.video.config.ts` (the n8n one needs the
local n8n container running).
