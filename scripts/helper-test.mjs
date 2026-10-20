// Helper milestone 1: bubble, panel, a streamed reply, saved across a reload, New chat. Laptop + phone.
// Uses a little Claude usage (one short question per width).
import { chromium } from "playwright";
const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const out = process.argv[2] || "/tmp/shots";
const browser = await chromium.launch();
for (const [label, viewport] of Object.entries({ laptop: { width: 1366, height: 900 }, phone: { width: 390, height: 844 } })) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.screenshot({ path: `${out}/${label}-1-bubble.png` });
  await page.getByRole("button", { name: /Open the Helper|Helper:/ }).click();
  const panel = page.getByRole("dialog", { name: "Helper" });
  await panel.waitFor();
  if (await panel.getByRole("button", { name: "New chat" }).isEnabled()) await panel.getByRole("button", { name: "New chat" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${label}-2-empty.png` });
  const t0 = Date.now();
  await panel.getByRole("button", { name: "What's running right now?" }).click();
  await panel.getByText(/Thinking…|Writing…|Reading|Looking|Checking/).first().waitFor({ timeout: 5000 });
  console.log(label, "Thinking shown after", Date.now() - t0, "ms");
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/${label}-3-streaming.png` });
  await panel.getByText(/Thinking…|Writing…/).waitFor({ state: "detached", timeout: 120000 });
  console.log(label, "reply done after", Date.now() - t0, "ms");
  await page.screenshot({ path: `${out}/${label}-4-reply.png` });
  // Saved: survives a reload.
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Open the Helper|Helper:/ }).click();
  await panel.getByText("What's running right now?").first().waitFor();
  console.log(label, "conversation kept after reload");
  // Goes to another page, stays open on laptop.
  const chip = panel.locator("a[href^='/agents/']").first();
  if (await chip.count()) {
    await chip.click();
    await page.waitForURL(/\/agents\/\d+/);
    console.log(label, "chip opened", page.url(), "panel open:", await panel.isVisible());
  }
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log(label, "sideways scroll:", sideways);
  console.log(label, errors.length ? `errors: ${errors.join(" | ")}` : "no console errors");
  await page.close();
}
await browser.close();
