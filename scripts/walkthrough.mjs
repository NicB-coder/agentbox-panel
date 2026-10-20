// First-time-user walkthrough: screenshots of every page and key states at laptop and phone width.
import { chromium } from "playwright";
const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const out = process.argv[2] || "/tmp/walk";
const pages = (process.argv[3] || "/,/agents/1,/agents/new,/inbox,/workflows,/workflows/new,/projects,/settings,/help").split(",");
const browser = await chromium.launch();
for (const [label, viewport] of Object.entries({ laptop: { width: 1366, height: 900 }, phone: { width: 390, height: 844 } })) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  for (const p of pages) {
    await page.goto(base + p, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/${label}${p.replace(/[^a-z0-9]+/gi, "-")}.png`, fullPage: !process.env.VIEWPORT_ONLY });
  }
  console.log(label, errors.length ? errors.join(" | ") : "no console errors");
  await page.close();
}
await browser.close();
