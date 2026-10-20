// End-to-end check of the agent editor in a real browser: create, edit, delete.
import { chromium } from "playwright";

const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const shots = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const main = page.locator("#main");
const fail = (m) => { console.log("✗", m); process.exitCode = 1; };

await page.goto(base + "/");
await page.getByRole("link", { name: "Add an agent" }).click();
await page.waitForURL("**/agents/new");
await main.getByRole("button", { name: "Save agent" }).click();
if (!(await main.getByRole("alert").textContent())?.includes("name")) fail("missing-name error not shown");

await main.getByLabel("Name").fill("Test Helper");
await main.getByLabel("Purple").check({ force: true });
await main.getByLabel("Book").check({ force: true });
await main.getByLabel("What should this agent do?").fill("Read the README and tell me what is unclear. Never change anything.");
await main.getByText("Certain days").click();
for (const d of ["Tuesday", "Thursday", "Friday"]) await main.getByLabel(d).uncheck({ force: true });
await main.getByLabel("At what time?").fill("09:30");
await main.getByText("Look onlyReads and reports").click();
await main.getByText("Plan first").click();
await main.getByLabel("Longest it can run").fill("45");
await main.getByText("Smartest (Opus)").click();
await main.getByRole("checkbox", { name: "Finished", exact: true }).uncheck({ force: true });
const sentence = await page.locator("p[aria-live=polite]").last().textContent();
console.log("summary:", sentence);
if (!sentence.includes("Mon, Wed at 9:30 AM")) fail("summary didn't update");
if (shots) await page.screenshot({ path: `${shots}/phone-editor-filled.png`, fullPage: true });
await main.getByRole("button", { name: "Save agent" }).click();
await page.waitForURL(/\/agents\/\d+$/);
const id = page.url().split("/").pop();
await page.getByRole("heading", { name: "Test Helper" }).waitFor();
console.log("✓ created agent", id);

const saved = await (await page.request.get(`${base}/api/agents/${id}`)).json();
const want = { color: "#7048C8", icon: "book", scheduleKind: "days", scheduleTime: "09:30", allowed: "look", mode: "plan", maxMinutes: 45, model: "opus" };
for (const [k, v] of Object.entries(want)) if (saved[k] !== v) fail(`${k} saved as ${saved[k]}, wanted ${v}`);
if (JSON.stringify(saved.scheduleDays.sort()) !== "[1,3]") fail("days not saved");
if (saved.notify.includes("finished")) fail("notify not saved");

await main.getByRole("link", { name: "Edit" }).click();
await main.getByLabel("Name").fill("Test Helper 2");
await main.getByText("Every hour").click();
await main.getByRole("switch").uncheck({ force: true });
await main.getByRole("button", { name: "Save agent" }).click();
await page.getByRole("heading", { name: "Test Helper 2" }).waitFor();
const edited = await (await page.request.get(`${base}/api/agents/${id}`)).json();
if (edited.scheduleKind !== "hourly" || edited.enabled !== false) fail("edit not saved");
else console.log("✓ edited");

await page.goto(base + "/");
if (!(await page.getByText("Test Helper 2").count())) fail("not on home page");
await page.goto(`${base}/agents/${id}/edit`);
page.once("dialog", (d) => d.accept());
await main.getByRole("button", { name: "Delete agent" }).click();
await page.waitForURL(base + "/");
const gone = await page.request.get(`${base}/api/agents/${id}`);
if (gone.status() !== 404) fail("not deleted"); else console.log("✓ deleted");
await browser.close();
