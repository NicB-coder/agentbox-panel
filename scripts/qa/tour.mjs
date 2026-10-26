// The welcome tour, clicked through for real at laptop and phone width: Next, Back, Skip, Just look around, replay from
// Help, and the Helper bubble on top of it (clickable, covering none of its buttons). Dev copy only.
// Usage: BASE_URL=http://127.0.0.1:3253 node scripts/qa/tour.mjs [shotsDir]
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3100";
const shots = process.argv[2] || "/tmp/agentbox-tour";
fs.mkdirSync(shots, { recursive: true });
let failed = 0;
const check = (ok, what) => (console.log(`${ok ? "✓" : "✗"} ${what}`), ok || failed++);
const b = await chromium.launch();
const tourDone = async (page) => (await (await page.request.get(`${BASE}/api/settings`)).json()).tourDone;

async function bubbleClear(page, label) {
  const d = page.locator("dialog[open]").last();
  const bubble = d.getByRole("button", { name: /Open the Helper/ });
  check(await bubble.isVisible(), `${label}: the Helper bubble is inside the tour`);
  const bb = await bubble.boundingBox();
  const overlaps = [];
  for (const btn of await d.locator("button, a").all()) {
    if ((await btn.getAttribute("aria-label"))?.startsWith("Open the Helper")) continue;
    const r = await btn.boundingBox();
    if (r && bb && r.x < bb.x + bb.width && bb.x < r.x + r.width && r.y < bb.y + bb.height && bb.y < r.y + r.height) overlaps.push((await btn.textContent())?.trim());
  }
  check(overlaps.length === 0, `${label}: the bubble covers no tour button${overlaps.length ? ` (covers ${overlaps.join(", ")})` : ""}`);
  await bubble.click();
  await page.waitForTimeout(600);
  check(await page.getByRole("textbox", { name: /Ask the Helper|Message|Ask/i }).first().isVisible().catch(() => false), `${label}: the Helper opens on top of the tour`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check((await d.isVisible()) && !(await page.getByPlaceholder("Ask anything…").isVisible()), `${label}: Escape closes only the Helper, the tour stays`);
}

for (const [size, viewport] of [["laptop", { width: 1366, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
  const page = await b.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.request.post(`${BASE}/api/settings`, { data: { tourDone: false } });
  await page.goto(BASE + "/");
  const d = page.locator("dialog[open]").last();
  await d.getByText("Welcome to agentbox").waitFor({ timeout: 10000 });
  check(true, `${size}: the tour opens on a first visit`);
  await page.screenshot({ path: `${shots}/${size}-tour-1.png` });
  await bubbleClear(page, size);
  for (const [n, title] of [[2, "Every task gets its own agent"], [3, "Workflows chain steps together"], [4, "The Inbox and the usage meter"]]) {
    await d.getByRole("button", { name: "Next" }).click();
    check(await d.getByText(title).isVisible(), `${size}: Next shows ${n} of 4: ${title}`);
  }
  await page.screenshot({ path: `${shots}/${size}-tour-4.png` });
  await d.getByRole("button", { name: "Back" }).click();
  check(await d.getByText("Workflows chain steps together").isVisible(), `${size}: Back goes back one`);
  await d.getByRole("button", { name: "Next" }).click();
  await d.getByRole("button", { name: "Just look around" }).click();
  check(!(await d.isVisible()) && (await tourDone(page)), `${size}: Just look around closes it and it's remembered`);
  await page.reload();
  await page.waitForTimeout(1000);
  check((await page.locator("dialog[open]").count()) === 0, `${size}: it doesn't come back on the next visit`);

  // Skip, and replay from the Help page.
  await page.request.post(`${BASE}/api/settings`, { data: { tourDone: false } });
  await page.goto(BASE + "/inbox");
  await page.getByRole("button", { name: "Skip the tour" }).click();
  check((await page.locator("dialog[open]").count()) === 0 && (await tourDone(page)), `${size}: Skip the tour closes it and it's remembered`);
  await page.goto(BASE + "/help");
  const replay = page.getByRole("button", { name: /tour/i }).first();
  await replay.click();
  check(await page.locator("dialog[open]").last().getByText("Welcome to agentbox").isVisible(), `${size}: the Help page's tour button shows it again`);
  await page.keyboard.press("Escape");
  check((await page.locator("dialog[open]").count()) === 0, `${size}: Escape closes the tour`);
  check(errors.length === 0, `${size}: no console errors${errors.length ? `: ${errors.slice(0, 2).join(" | ")}` : ""}`);
  await page.close();
}
await b.close();
console.log(failed ? `\n${failed} check(s) failed` : "\nAll tour checks passed");
process.exit(failed ? 1 : 0);
