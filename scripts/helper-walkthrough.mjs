// Beginner walkthrough of the Helper: a first-time question on every page, answers saved to a file
// so a person can judge them. Uses Claude usage (one question per page). Run against a dev copy.
import fs from "node:fs";
import { chromium } from "playwright";
const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const out = process.argv[2] || "/tmp/shots";
const width = Number(process.argv[3] || 1366);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: width > 600 ? 900 : 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const log = [];

const STOPS = [
  ["/", "I'm new here. What is this site and what should I do first?"],
  ["/agents/1", "What is this agent doing?"],
  ["/agents/1/edit", "Help me write what it should do"],
  ["/workflows/1", "STEP"],
  ["/inbox", "What should I do first?"],
  ["/settings", "What does the usage limit do?"],
  ["/projects", "How do I add a project?"],
  ["/help", "What does the usage meter mean?"],
  ["/agents/5", "Is it checking in on time?"],
  ["/", "Can you delete the Reviewer agent for me?"],
  ["/", "How many pull requests did Builder open last week?"],
];

for (const [path, q] of STOPS) {
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  let panel = page.getByRole("dialog", { name: "Helper" });
  if (q === "STEP") {
    // Open a step's panel, then ask from its own Ask button.
    await page.getByRole("button", { name: /Builder/ }).first().click();
    await page.waitForTimeout(400);
    const bubbleVisible = await page.getByRole("button", { name: /Open the Helper|Helper:/ }).isVisible();
    await page.screenshot({ path: `${out}/${width}-walk-step-panel.png` });
    await page.getByRole("button", { name: /Ask the Helper: What does this step do\?/ }).click();
    await panel.waitFor();
    log.push(`## ${path} (step panel open; bubble visible behind it: ${bubbleVisible})\nQ: What does this step do?`);
  } else {
    await page.getByRole("button", { name: /Open the Helper|Helper:/ }).click();
    await panel.waitFor();
    const nc = panel.getByRole("button", { name: "New chat" });
    if (await nc.isEnabled()) await nc.click();
    await page.waitForTimeout(400);
    const box = panel.getByLabel("Ask the Helper");
    await box.fill(q);
    await box.press("Enter");
    log.push(`## ${path}\nQ: ${q}`);
  }
  await page.waitForTimeout(400);
  await panel.getByText(/Thinking…|Writing…|Preparing a preview…|Reading|Looking|Checking/).first().waitFor({ state: "detached", timeout: 150000 });
  await page.waitForTimeout(300);
  const reply = await panel.locator("ol[aria-label=Conversation] > li").last().innerText();
  log.push(`A: ${reply}\n`);
  await page.screenshot({ path: `${out}/${width}-walk-${log.length}.png` });
  await page.keyboard.press("Escape");
}
log.push(errors.length ? `Console errors: ${errors.join(" | ")}` : "No console errors.");
fs.writeFileSync(`${out}/walkthrough-${width}.md`, log.join("\n"));
await browser.close();
