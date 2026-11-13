import { execSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { test } from "@playwright/test";
import { card } from "./helpers";
import { diagram, load } from "./diagram";

// The n8n editor needs the owner's login, so this video shows what the workflows do instead: the real exported workflow
// graphs, then real runs (the HL7 inbox against the deployed app, and the care-gap sweep) with their real output.
test("record the n8n video", async ({ page }) => {
  test.setTimeout(600_000);
  const stage = async (title: string, svg: string, term: string) =>
    page.setContent(
      `<body style="margin:0;background:#14202e;color:#fff;font-family:system-ui;height:100vh;display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:14px;box-sizing:border-box"><div><h2 style="margin:0 0 8px;font-size:20px">${title}</h2>${svg}</div><pre id="t" style="margin:0;background:#0b121a;border-radius:10px;padding:14px;font:13px/1.45 ui-monospace,Menlo,monospace;color:#d6e2ee;overflow:hidden;white-space:pre-wrap">${term}</pre></body>`,
    );
  const show = async (text: string) =>
    page.evaluate((t) => {
      (document.getElementById("t") as HTMLElement).textContent = t;
    }, text);
  const sh = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8", timeout: 240_000, shell: "/bin/bash" }).trim();
    } catch (e) {
      return String((e as { stdout?: string }).stdout ?? e).trim();
    }
  };
  const wait = (ms: number) => page.waitForTimeout(ms);
  const stamp = () => Date.now().toString(36).toUpperCase();
  let screen = "";
  const type = async (line: string) => {
    screen += line + "\n";
    await show(screen);
    await wait(600);
  };

  await card(
    page,
    "ClinIQ + n8n",
    [
      "Two workflows call the ClinIQ API with an integration key.",
      "n8n never talks to the FHIR server.",
      "Real exported workflows, real runs.",
    ],
    5000,
  );

  // Workflow 1: pathology inbox
  await stage("1. Pathology inbox (webhook)", diagram(load("pathology-inbox"), "#4aa3ff"), "");
  await wait(7000);
  screen = "";
  await type("$ n8n/drop.sh oru-demo-creatinine.hl7");
  const msg = readFileSync("data/hl7v2/oru-demo-creatinine.hl7", "utf8").replace(
    "DEMO00001",
    `REC${stamp()}`,
  );
  writeFileSync("/tmp/rec-demo.hl7", msg);
  const t0 = Date.now();
  const ok = sh("n8n/drop.sh /tmp/rec-demo.hl7").replace(/\r/g, "\n");
  await type(ok.split("\n").filter(Boolean).join("\n") + `   (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  await wait(3500);
  await type("$ ls /home/node/.n8n-files/hl7/done");
  await type(sh("docker exec n8n-n8n-1 ls /home/node/.n8n-files/hl7/done"));
  await wait(3500);

  // Failure path
  await type("");
  await type("$ n8n/drop.sh oru-creatinine.hl7   # a patient ClinIQ does not have");
  const t1 = Date.now();
  const bad = sh("n8n/drop.sh data/hl7v2/oru-creatinine.hl7").replace(/\r/g, "\n");
  await type(
    bad.split("\n").filter(Boolean).join("\n") +
      `   (${((Date.now() - t1) / 1000).toFixed(1)} s: 3 retries with back-off)`,
  );
  await wait(3500);
  await type("$ ls hl7/failed; cat the notice");
  await type(
    sh(
      "docker exec n8n-n8n-1 sh -c 'ls /home/node/.n8n-files/hl7/failed; cat /home/node/.n8n-files/hl7/failed/oru-creatinine.hl7.notice.txt'",
    ),
  );
  await wait(6000);

  // Workflow 2: sweep
  screen = "";
  await stage(
    "2. Weekly care-gap sweep (Mondays 07:00 Sydney)",
    diagram(load("care-gap-sweep"), "#5fd38d"),
    "",
  );
  await wait(5000);
  await type("$ n8n execute --id=cliniq-care-gap-sweep");
  const run = () =>
    sh(
      'docker exec -e N8N_RUNNERS_BROKER_PORT=5699 -e N8N_RUNNERS_MODE=internal n8n-n8n-1 n8n execute --id=cliniq-care-gap-sweep 2>&1 | grep -E \'"summary"|"status"\' | head -2',
    );
  await type(run().replace(/\s{2,}/g, " "));
  await wait(4500);
  await type("");
  await type("$ n8n execute --id=cliniq-care-gap-sweep   # run it again: nothing new");
  await type(run().replace(/\s{2,}/g, " "));
  await wait(6000);

  await card(
    page,
    "Idempotent by design",
    [
      "A resent HL7 message is acknowledged, not duplicated.",
      "A second sweep creates no new Tasks.",
      "A failed message is kept, with a notice, for a human.",
    ],
    6000,
  );

  const path = await page.video()!.path();
  await page.context().close();
  mkdirSync("docs/video", { recursive: true });
  copyFileSync(path, "docs/video/cliniq-n8n.webm");
});
