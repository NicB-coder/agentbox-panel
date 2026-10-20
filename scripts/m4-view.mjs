// Screenshots of a workflow's live view and the Inbox, then approves the waiting step from the Inbox.
import { chromium } from "playwright";
const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const [out = "/tmp/shots", wid] = process.argv.slice(2);
const browser = await chromium.launch();
for (const [label, viewport] of Object.entries({ laptop: { width: 1366, height: 900 }, phone: { width: 390, height: 844 } })) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`${base}/workflows/${wid}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${out}/${label}-wf-live.png`, fullPage: true });
  await page.getByRole("button", { name: /^Step 3:/ }).click();
  await page.screenshot({ path: `${out}/${label}-wf-live-step.png` });
  await page.goto(`${base}/inbox`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${out}/${label}-inbox-wf.png`, fullPage: true });
  console.log(label, errors.length ? errors.join(" | ") : "no console errors");
  await page.close();
}
if (process.env.APPROVE) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  await page.goto(`${base}/inbox`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Approve", exact: true }).first().click();
  await page.waitForTimeout(4000);
  await page.goto(`${base}/workflows/${wid}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${out}/laptop-wf-after.png`, fullPage: true });
}
await browser.close();
