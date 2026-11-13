import type { Locator, Page } from "@playwright/test";

/** A visible caption bar and a fake cursor, so a silent screen recording explains itself. */
export async function setup(page: Page) {
  await page.addInitScript(() => {
    const install = () => {
      if (document.getElementById("rec-caption")) return;
      const cap = document.createElement("div");
      cap.id = "rec-caption";
      cap.style.cssText =
        "position:fixed;left:0;right:0;bottom:0;z-index:2147483647;padding:14px 28px;background:rgba(20,28,38,.92);color:#fff;font:600 20px/1.35 system-ui,sans-serif;text-align:center;display:none";
      const dot = document.createElement("div");
      dot.id = "rec-cursor";
      dot.style.cssText =
        "position:fixed;z-index:2147483647;width:22px;height:22px;border-radius:50%;background:rgba(255,196,0,.55);border:2px solid #b58900;pointer-events:none;transform:translate(-50%,-50%);left:-50px;top:-50px;transition:left .05s,top .05s";
      document.documentElement.append(cap, dot);
      window.addEventListener("mousemove", (e) => {
        dot.style.left = e.clientX + "px";
        dot.style.top = e.clientY + "px";
      });
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
    else install();
  });
}

export const caption = (page: Page, text: string) =>
  page.evaluate((t) => {
    const el = document.getElementById("rec-caption");
    if (!el) return;
    el.textContent = t;
    el.style.display = t ? "block" : "none";
  }, text);

export const pause = (page: Page, ms: number) => page.waitForTimeout(ms);

/** Moves the visible cursor to the element, then clicks it. */
export async function glide(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 25 });
  await page.waitForTimeout(350);
  await target.click();
}

/** A title card over a plain background (shown inside the page so it is part of the recording). */
export async function card(page: Page, title: string, lines: string[], ms: number) {
  await page.setContent(
    `<body style="margin:0;height:100vh;display:grid;place-items:center;background:#14202e;color:#fff;font-family:system-ui,sans-serif;text-align:center"><div><h1 style="font-size:44px;margin:0 0 18px">${title}</h1>${lines.map((l) => `<p style="font-size:24px;margin:8px 0;color:#c9d6e2">${l}</p>`).join("")}</div></body>`,
  );
  await page.waitForTimeout(ms);
}
