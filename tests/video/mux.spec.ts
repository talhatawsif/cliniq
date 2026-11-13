import { createServer } from "node:http";
import { createReadStream, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { expect, test } from "@playwright/test";

// Puts the narration on the silent demo video without an external encoder: Chromium plays the video, plays the audio clips at
// their recorded times (timeline.json), and records both with MediaRecorder. Takes as long as the video (real time).
const ROOT = "docs/video";
const TYPES: Record<string, string> = { ".webm": "video/webm", ".mp3": "audio/mpeg", ".html": "text/html" };

test.use({ launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] } });

test("add the narration to the demo video", async ({ page }) => {
  test.setTimeout(900_000);
  const server = createServer((req, res) => {
    const file = join(ROOT, decodeURIComponent((req.url ?? "/").split("?")[0]));
    try {
      const size = statSync(file).size;
      res.writeHead(200, {
        "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
        "Content-Length": size,
        "Accept-Ranges": "bytes",
      });
      createReadStream(file).pipe(res);
    } catch {
      res.writeHead(404).end();
    }
  }).listen(0);
  const port = (server.address() as { port: number }).port;
  writeFileSync(join(ROOT, "mux.html"), "<!doctype html><title>mux</title><body></body>");
  const timeline = JSON.parse(readFileSync(join(ROOT, "audio/timeline.json"), "utf8")) as Record<
    string,
    number
  >;
  const chunks: Buffer[] = [];
  await page.exposeFunction("sendChunk", (b64: string) => chunks.push(Buffer.from(b64, "base64")));
  await page.goto(`http://localhost:${port}/mux.html`);

  const info = await page.evaluate(
    async ({ timeline }) => {
      const v = document.createElement("video");
      v.src = "/cliniq-demo-silent.webm";
      v.muted = true;
      document.body.append(v);
      await new Promise((r) => (v.onloadedmetadata = r));

      // Where does the first title card start in the video? (the first frame that is no longer white)
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 36;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      let offset = 0;
      for (let t = 0; t < 8; t += 0.05) {
        v.currentTime = t;
        await new Promise((r) => (v.onseeked = r));
        ctx.drawImage(v, 0, 0, 64, 36);
        const [r] = ctx.getImageData(32, 18, 1, 1).data;
        if (r < 100) {
          offset = t;
          break;
        }
      }

      const ac = new AudioContext();
      const dest = ac.createMediaStreamDestination();
      const buffers: Record<string, AudioBuffer> = {};
      for (const id of Object.keys(timeline)) {
        if (id === "end") continue;
        buffers[id] = await ac.decodeAudioData(await (await fetch(`/audio/${id}.mp3`)).arrayBuffer());
      }
      v.currentTime = 0;
      await new Promise((r) => (v.onseeked = r));
      const stream = new MediaStream([
        ...(v as HTMLVideoElement & { captureStream(): MediaStream }).captureStream().getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);
      const rec = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9,opus",
        videoBitsPerSecond: 3_000_000,
        audioBitsPerSecond: 128_000,
      });
      rec.ondataavailable = async (e) => {
        const b = new Uint8Array(await e.data.arrayBuffer());
        let s = "";
        for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
        await (window as unknown as { sendChunk(s: string): Promise<void> }).sendChunk(btoa(s));
      };
      const finished = new Promise((r) => (rec.onstop = r));
      rec.start(2000);
      await ac.resume();
      await v.play();
      const base = ac.currentTime;
      for (const [id, t] of Object.entries(timeline)) {
        if (id === "end") continue;
        const src = ac.createBufferSource();
        src.buffer = buffers[id];
        src.connect(dest);
        src.start(base + t + offset);
      }
      await new Promise((r) => (v.onended = r));
      await new Promise((r) => setTimeout(r, 1500));
      rec.stop();
      await finished;
      await new Promise((r) => setTimeout(r, 1500));
      return { offset, duration: v.duration };
    },
    { timeline },
  );
  server.close();
  console.log("MUX", JSON.stringify(info));
  writeFileSync(join(ROOT, "cliniq-demo.webm"), Buffer.concat(chunks));
  expect(chunks.length).toBeGreaterThan(5);
});
