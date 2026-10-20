// Helper milestones 3 + 4: page suggestions, chips, action buttons with "Are you sure?",
// and "Make me an agent / a workflow" → preview card → Create it (saved Off, opens the editor).
// Uses some Claude usage. Run it against a dev copy (BASE_URL=http://127.0.0.1:3100).
import { chromium } from "playwright";
const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const out = process.argv[2] || "/tmp/shots";
const only = process.argv[3]; // optional: laptop | phone
const browser = await chromium.launch();

async function ask(page, panel, text) {
  const box = panel.getByLabel("Ask the Helper");
  await box.fill(text);
  await box.press("Enter");
  await page.waitForTimeout(300);
  await panel.getByText(/Thinking…|Writing…|Preparing a preview…|Reading|Looking|Checking/).first().waitFor({ state: "detached", timeout: 150000 });
  await page.waitForTimeout(300);
}

async function openHelper(page) {
  await page.getByRole("button", { name: /Open the Helper|Helper:/ }).click();
  const panel = page.getByRole("dialog", { name: "Helper" });
  await panel.waitFor();
  const nc = panel.getByRole("button", { name: "New chat" });
  if (await nc.isEnabled()) await nc.click();
  await page.waitForTimeout(400);
  return panel;
}

for (const [label, viewport] of Object.entries({ laptop: { width: 1366, height: 900 }, phone: { width: 390, height: 844 } })) {
  if (only && only !== label) continue;
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  // Suggestions per page
  for (const p of ["/", "/agents/2", "/workflows", "/workflows/new", "/inbox", "/agents/new"]) {
    await page.goto(base + p, { waitUntil: "networkidle" });
    const panel = await openHelper(page);
    const s = await panel.getByRole("group", { name: "Suggested questions" }).getByRole("button").allTextContents();
    console.log(label, p, "suggestions:", s.join(" · "));
    await panel.getByRole("button", { name: "Close the Helper" }).first().click();
  }

  // Why did this stop? → chip + Try again button (not clicked: it would start a real run)
  await page.goto(base + "/agents/2", { waitUntil: "networkidle" });
  let panel = await openHelper(page);
  const why = panel.getByRole("button", { name: "Why did this stop?" });
  if (await why.count()) {
    await why.click();
    await page.waitForTimeout(300);
    await panel.getByText(/Thinking…|Writing…|Reading|Looking|Checking/).first().waitFor({ state: "detached", timeout: 150000 });
    await page.waitForTimeout(300);
    console.log(label, "why buttons:", (await panel.locator("li button").allTextContents()).join(" · "));
    await page.screenshot({ path: `${out}/${label}-why.png` });
  }

  if (label === "laptop") {
    // A risky action asks first.
    await ask(page, panel, "Can you pause everything for me?");
    const pause = panel.getByRole("button", { name: /Pause everything/ });
    if (await pause.count()) {
      await pause.first().click();
      const dlg = page.getByRole("dialog", { name: "Are you sure?" });
      await dlg.waitFor();
      await page.screenshot({ path: `${out}/${label}-confirm.png` });
      await dlg.getByRole("button", { name: /Pause everything/ }).click();
      await page.getByText("Everything is paused.").waitFor();
      console.log(label, "pause everything worked after Are you sure?");
      await page.getByRole("button", { name: "Resume everything" }).first().click();
      await page.getByText("Everything is paused.").waitFor({ state: "detached" });
    } else console.log(label, "NO pause button offered");
  }

  // Make me an agent
  await page.goto(base + "/", { waitUntil: "networkidle" });
  panel = await openHelper(page);
  await ask(page, panel, `Make me an agent called Link Checker ${label} that looks at the agentbox-panel project every morning at 7 and tells me about broken links in the README. Look only.`);
  let create = panel.getByRole("button", { name: "Create it" });
  if (!(await create.count())) {
    console.log(label, "helper asked:", (await panel.locator("li").last().textContent()).slice(0, 200));
    await ask(page, panel, "Just pick sensible defaults and show me the preview.");
    create = panel.getByRole("button", { name: "Create it" });
  }
  await page.screenshot({ path: `${out}/${label}-agent-card.png` });
  await create.first().click();
  await page.waitForURL(/\/agents\/\d+\/edit/, { timeout: 15000 });
  const on = await page.getByRole("switch").first().isChecked();
  console.log(label, "agent created →", page.url(), "switched on:", on);
  await page.screenshot({ path: `${out}/${label}-agent-editor.png` });

  // Help me build a workflow
  await page.goto(base + "/workflows/new", { waitUntil: "networkidle" });
  panel = await openHelper(page);
  await panel.getByRole("button", { name: "Help me build a workflow" }).click();
  await page.waitForTimeout(300);
  await panel.getByText(/Thinking…|Writing…|Preparing a preview…/).first().waitFor({ state: "detached", timeout: 150000 });
  console.log(label, "workflow helper said:", (await panel.locator("li").last().textContent()).slice(0, 300));
  await ask(page, panel, `When I give it an idea, Builder builds it in agentbox-panel, Reviewer checks it and sends it back if needed, then it asks me before shipping. Call it Idea to PR ${label}.`);
  create = panel.getByRole("button", { name: "Create it" });
  if (!(await create.count())) {
    await ask(page, panel, "Sounds good, show me the preview.");
    create = panel.getByRole("button", { name: "Create it" });
  }
  await page.screenshot({ path: `${out}/${label}-workflow-card.png` });
  await create.first().click();
  await page.waitForURL(/\/workflows\/\d+/, { timeout: 15000 });
  console.log(label, "workflow created →", page.url());
  await page.screenshot({ path: `${out}/${label}-workflow-editor.png` });

  const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log(label, "sideways scroll:", sideways);
  console.log(label, errors.length ? `errors: ${errors.join(" | ")}` : "no console errors");
  await page.close();
}
await browser.close();
