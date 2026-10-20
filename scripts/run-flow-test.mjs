// Drives real agent runs through the UI: Ask-each-step (Deny), Plan-first (Change it, then Approve), and Stop.
// Uses Claude for real, so it costs a little. Usage: node scripts/run-flow-test.mjs [screenshotDir]
import { chromium } from "playwright";

const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const shots = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const main = page.locator("#main");
const state = async (id) => (await page.request.get(`${base}/api/agents/${id}/state`)).json();
const waitFor = async (id, pred, label, secs = 240) => {
  for (let i = 0; i < secs / 2; i++) {
    const s = await state(id);
    if (pred(s)) return s;
    await page.waitForTimeout(2000);
  }
  throw new Error(`timed out waiting for: ${label}`);
};
const shot = (name) => shots && page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
const startTask = async (id, task, modeLabel) => {
  await page.goto(`${base}/agents/${id}`);
  await main.getByPlaceholder("For example: Make the header").fill(task);
  await main.getByText(modeLabel, { exact: true }).click();
  await main.getByRole("button", { name: "Start" }).click();
};

// 1. Ask me each step → Deny
await startTask(1, "Create a file named hello.txt in the project containing the word hi. Use the Write tool.", "Ask me each step");
await main.getByRole("button", { name: "Allow" }).waitFor({ timeout: 180000 });
console.log("✓ ask: approval shown:", await main.locator("text=It wants to:").locator("..").locator("p").nth(1).textContent());
await shot("laptop-agent-ask");
await page.goto(base + "/");
if (!(await page.getByText("Waiting for your OK").count())) console.log("✗ home tile doesn't say Waiting for your OK");
else console.log("✓ home tile says Waiting for your OK");
await shot("laptop-home-needs-you");
await page.goto(`${base}/agents/1`);
await main.getByRole("button", { name: "Deny" }).click();
let s = await waitFor(1, (s) => !s.view.activeRun, "ask run to finish");
console.log("✓ ask run ended:", s.runs[0].status, "-", (s.runs[0].result || s.runs[0].stopReason || "").slice(0, 120));

// 2. Plan first → Change it → Approve plan
await startTask(2, "Check README.md for spelling mistakes and tell me what you find.", "Plan first");
await main.getByRole("button", { name: "Approve plan" }).waitFor({ timeout: 180000 });
console.log("✓ plan shown");
await shot("laptop-agent-plan");
await main.getByRole("button", { name: "Change it" }).click();
await main.getByLabel("What should it change?").fill("Keep the plan to two steps.");
await main.getByRole("button", { name: "Send" }).click();
await page.waitForTimeout(3000);
await main.getByRole("button", { name: "Approve plan" }).waitFor({ timeout: 180000 });
console.log("✓ revised plan shown:", (await state(2)).view.activeRun.plan.slice(0, 160).replace(/\n/g, " "));
await main.getByRole("button", { name: "Approve plan" }).click();
s = await waitFor(2, (s) => !s.view.activeRun, "plan run to finish");
console.log("✓ plan run ended:", s.runs[0].status, "-", (s.runs[0].result || s.runs[0].stopReason || "").slice(0, 120));

// 3. Stop
await startTask(1, "Run the shell command `sleep 300` and then say done.", "Auto");
await main.getByRole("button", { name: "Stop" }).waitFor();
await page.waitForTimeout(8000);
await shot("laptop-agent-working");
await main.getByRole("button", { name: "Stop" }).click();
s = await waitFor(1, (s) => !s.view.activeRun, "stop");
console.log(s.runs[0].stopReason === "You stopped it." ? "✓ stopped" : `✗ stop gave ${s.runs[0].status} ${s.runs[0].stopReason}`);
await shot("laptop-agent-history");
await browser.close();
