// Every input, menu, slider and text box has a name a screen reader can read (a label that really points at it,
// aria-label or aria-labelledby). Also opens Start a task and a workflow step's panel.
// Usage: BASE_URL=http://127.0.0.1:3253 node scripts/qa/labels.mjs
import { chromium } from "playwright";
const BASE = process.env.BASE_URL || "http://127.0.0.1:3100";
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1366, height: 900 } });
await page.request.post(`${BASE}/api/settings`, { data: { tourDone: true } });
const state = await (await page.request.get(`${BASE}/api/state`)).json();
const wfs = await (await page.request.get(`${BASE}/api/workflows/state`)).json();
const paths = ["/", "/inbox", "/workflows", "/workflows/new", "/projects", "/settings", "/help", "/machine", "/connectors", "/terminal"];
for (const { agent } of state.views) paths.push(`/agents/${agent.id}`, `/agents/${agent.id}/edit`);
for (const w of wfs.tiles) paths.push(`/workflows/${w.id}`);
const unnamed = (p) => page.evaluate((p) => [...document.querySelectorAll("input:not([type=hidden]):not([type=file]), select, textarea")]
  .filter((el) => el.getBoundingClientRect().width > 0 || el.matches(".sr-only"))
  .filter((el) => !(el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || [...(el.labels ?? [])].some((l) => l.textContent.trim())))
  .map((el) => `${p}: ${el.tagName.toLowerCase()}[${el.type}] ${el.outerHTML.slice(0, 120)}`), p);
let bad = [];
for (const p of paths) {
  await page.goto(BASE + p); await page.waitForTimeout(800);
  bad.push(...(await unnamed(p)));
}
await page.goto(BASE + "/"); await page.getByRole("button", { name: "New task" }).click(); await page.waitForTimeout(500);
await page.locator("dialog[open]").getByRole("button", { name: /More options/ }).click().catch(() => {});
bad.push(...(await unnamed("Start a task panel")));
await page.goto(`${BASE}/workflows/${wfs.tiles[0].id}`);
for (const step of await page.getByRole("button", { name: /^Step \d+:/ }).all()) {
  await step.click(); await page.waitForTimeout(300);
  await page.waitForTimeout(0);
  bad.push(...(await unnamed(`step panel ${await step.getAttribute("aria-label") ?? ""}`.slice(0, 60))));
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
}
bad = [...new Set(bad)];
console.log(bad.length ? bad.join("\n") : "Every box, menu and slider has a name");
await b.close();
process.exit(bad.length ? 1 : 0);
