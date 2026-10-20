// Milestone 2: workflows list, templates, editor (steps, undo, save, versions, drag).
import { chromium } from "playwright";
const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const out = process.argv[2] || "/tmp/shots";
const browser = await chromium.launch();
const results = [];
const ok = (c, m) => results.push(`${c ? "✓" : "✗"} ${m}`);
for (const [label, viewport] of Object.entries({ laptop: { width: 1366, height: 900 }, phone: { width: 390, height: 844 } })) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("dialog", (d) => d.accept());
  await page.goto(base + "/workflows/new", { waitUntil: "networkidle" });
  await page.screenshot({ path: `${out}/${label}-wf-new.png`, fullPage: true });
  await page.getByRole("button", { name: /Build → Review → Ship/ }).click();
  await page.waitForURL(/\/workflows\/\d+/);
  await page.getByRole("button", { name: /^Step 1:/ }).waitFor();
  await page.screenshot({ path: `${out}/${label}-wf-editor.png`, fullPage: true });
  const n0 = await page.getByRole("button", { name: /^Step \d+:/ }).count();
  ok(n0 === 8, `${label}: template has 8 steps (${n0})`);
  // open a step
  await page.getByRole("button", { name: /^Step 4: Review/ }).click();
  await page.getByRole("complementary").waitFor();
  await page.screenshot({ path: `${out}/${label}-wf-step-panel.png` });
  await page.getByRole("complementary").getByRole("button", { name: "Done" }).click();
  // add a Tell me at the end
  await page.getByRole("button", { name: "Add a step at the end" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /^Tell me/ }).click();
  await page.getByRole("complementary").getByRole("button", { name: "Done" }).click();
  const n1 = await page.getByRole("button", { name: /^Step \d+:/ }).count();
  ok(n1 === 9, `${label}: added a step (${n1})`);
  await page.getByRole("button", { name: "Undo" }).click();
  const n2 = await page.getByRole("button", { name: /^Step \d+:/ }).count();
  ok(n2 === 8, `${label}: undo removed it (${n2})`);
  await page.getByRole("button", { name: "Redo" }).click();
  // move with keyboard on the grip: step 2 (Research) later
  await page.getByRole("button", { name: /^Move Research/ }).focus();
  await page.keyboard.press(label === "phone" ? "ArrowDown" : "ArrowRight");
  const third = await page.getByRole("button", { name: /^Step 3:/ }).getAttribute("aria-label");
  ok(third.includes("Research"), `${label}: keyboard move put Research at step 3`);
  // drag Research back to step 2
  const grip = page.getByRole("button", { name: /^Move Research/ });
  const target = page.getByRole("button", { name: /^Step 2:/ });
  await grip.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const g = await grip.boundingBox();
  const t = await target.boundingBox();
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    const x = label === "phone" ? g.x + g.width / 2 : g.x + (t.x - g.x) * (i / 10);
    const y = label === "phone" ? g.y + (t.y - g.y) * (i / 10) : g.y + g.height / 2;
    await page.mouse.move(x, y);
  }
  await page.mouse.up();
  const second = await page.getByRole("button", { name: /^Step 2:/ }).getAttribute("aria-label");
  ok(second.includes("Research"), `${label}: drag put Research back at step 2`);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Saved", exact: true }).waitFor();
  // version history
  await page.getByRole("button", { name: "Version history" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Restore" }).first().click();
  const n3 = await page.getByRole("button", { name: /^Step \d+:/ }).count();
  ok(n3 === 8, `${label}: restored the first version (${n3} steps)`);
  await page.screenshot({ path: `${out}/${label}-wf-restored.png`, fullPage: true });
  await page.goto(base + "/workflows", { waitUntil: "networkidle" });
  await page.screenshot({ path: `${out}/${label}-wf-list.png`, fullPage: true });
  ok(!errors.length, `${label}: no console errors ${errors.join(" | ")}`);
  await page.close();
}
await browser.close();
console.log(results.join("\n"));
