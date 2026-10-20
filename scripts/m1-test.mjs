// Milestone 1: header, usage panel, Pause everything, Inbox and ideas.
import { chromium } from "playwright";
const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const out = process.argv[2] || "/tmp/shots";
const browser = await chromium.launch();
for (const [label, viewport] of Object.entries({ laptop: { width: 1366, height: 900 }, phone: { width: 390, height: 844 } })) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(base + "/inbox", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Show usage details/ }).click();
  await page.screenshot({ path: `${out}/${label}-usage-panel.png` });
  await page.keyboard.press("Escape");
  if (label === "phone") await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Pause everything" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Pause everything" }).click();
  await page.getByText("Everything is paused.").waitFor();
  await page.screenshot({ path: `${out}/${label}-paused.png` });
  await page.getByRole("button", { name: "Resume everything" }).first().click();
  await page.getByText("Everything is paused.").waitFor({ state: "detached" });
  await page.getByLabel("New idea").fill(`Test idea ${label}`);
  await page.getByRole("button", { name: "Add idea" }).click();
  await page.getByText(`Test idea ${label}`).waitFor();
  await page.screenshot({ path: `${out}/${label}-inbox.png`, fullPage: true });
  await page.getByRole("button", { name: "Make it a task" }).first().click();
  await page.getByRole("heading", { name: "New task" }).waitFor();
  const val = await page.getByLabel("What should it do?").inputValue();
  console.log(label, "task prefilled:", val);
  await page.getByRole("button", { name: "Cancel" }).click();
  console.log(label, errors.length ? `errors: ${errors.join(" | ")}` : "no console errors");
  await page.close();
}
await browser.close();
