# Demo recordings

Recorded by Playwright against the deployed app, with an on-screen cursor and captions (no audio):

- `cliniq-demo.webm` (about 4.7 minutes, with narration): sign-in, worklist, chart, decision support, assistant (cited answers, refused advice),
  pathology and vitals trends, AU Patient Summary export, note to coded FHIR with the review queue, HL7 v2 in, and the About page.
- `cliniq-n8n.webm` (about 1.5 minutes): the two n8n workflows (the exported graphs) and real runs: an HL7 message accepted and
  filed in `done/`, a message for an unknown patient retried three times and filed in `failed/` with a notice, and the care-gap
  sweep run twice (Tasks created once). The n8n editor itself needs the owner's login, so it is not shown.

The files are not in git (about 25 MB). Re-record with `npx playwright test -c playwright.video.config.ts` (the n8n one needs the
local n8n container running).

## Narration

The demo has a voice-over: the script is `tests/video/narration.json`, spoken by the free Microsoft neural voice `en-AU-NatashaNeural`
through the `edge-tts` Python package (it uses Microsoft's online read-aloud service; only the script text is sent). The recording
waits for each clip, saves each step's start time, and `tests/video/mux.spec.ts` plays the clips at those times and records video
and audio together in Chromium (no ffmpeg needed). To redo it:

```bash
python3 -m venv /tmp/tts && /tmp/tts/bin/pip install edge-tts      # then write docs/video/audio/<id>.mp3 and durations.json
npx playwright test -c playwright.video.config.ts demo             # silent video + timeline.json
npx playwright test -c playwright.video.config.ts mux              # narrated cliniq-demo.webm (takes the length of the video)
```
The narrated file has no duration header (MediaRecorder output), so some players cannot seek in it.
