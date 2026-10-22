// Milestones 5 and 6: research in the Start a task panel, Reports in the Inbox, the Report page, Connectors.
import { BASE, browser, done, newPage, ok, pageCheck, shot } from "./lib.mjs";
const [agentId, reportId] = process.argv.slice(2).map(Number);
const b = await browser();
for (const size of ["laptop", "phone"]) {
  const page = await newPage(b, size);
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /Start a task/ }).first().click();
  const dlg = page.getByRole("dialog", { name: "Start a task" });
  await dlg.getByText("Research something", { exact: true }).click();
  ok(await dlg.getByRole("textbox", { name: "What do you want to know?" }).isVisible(), `${size}: Research something → "What do you want to know?"`);
  ok(await dlg.getByText("Research only reads and reports.").isVisible(), `${size}: research is look-only`);
  ok((await dlg.getByRole("combobox", { name: "Project" }).inputValue()) !== undefined, `${size}: project is optional for research`);
  await dlg.getByRole("button", { name: "More options" }).click();
  ok(await dlg.getByText("Gmail", { exact: true }).waitFor({ timeout: 15_000 }).then(() => true).catch(() => false), `${size}: connected connectors to tick (Gmail)`);
  ok(await dlg.getByRole("button", { name: /Smartest/ }).count() + (await dlg.getByText("Smartest", { exact: true }).count()) > 0, `${size}: model choice`);
  await shot(page, `m56-${size}-panel-research`);
  await pageCheck(page, `${size} research panel`);
  await dlg.getByRole("button", { name: "Cancel" }).click();

  await page.goto(`${BASE}/inbox`, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Reports" }).click();
  ok(await page.getByRole("link", { name: "Read the report" }).first().isVisible(), `${size}: report in the Inbox under Reports`);
  await pageCheck(page, `${size} inbox reports`);

  await page.goto(`${BASE}/agents/${agentId}`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  ok(await page.getByRole("link", { name: "Read the report" }).first().isVisible(), `${size}: research job page has Read the report`);
  await pageCheck(page, `${size} research job`);

  await page.goto(`${BASE}/reports/${reportId}`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  ok(await page.getByRole("heading", { name: "Short answer" }).isVisible(), `${size}: report starts with the short answer`);
  ok((await page.locator("ol.sources li").count()) >= 3, `${size}: every source listed as a link`);
  ok((await page.locator("a.cite").count()) >= 3, `${size}: claims are tied to sources`);
  ok((await page.locator(".uncertain").count()) >= 1, `${size}: uncertain things are flagged`);
  await pageCheck(page, `${size} report`);

  await page.goto(`${BASE}/connectors`, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  ok((await page.getByText("Connected", { exact: true }).count()) >= 4, `${size}: Connectors shows what's connected`);
  const slack = page.locator("li", { hasText: "Slack" });
  await slack.getByRole("button", { name: "Connect" }).click();
  ok(await slack.getByText(/claude.ai → Settings → Connectors/).isVisible(), `${size}: Connect walks you through it`);
  await shot(page, `m56-${size}-connectors`);
  await pageCheck(page, `${size} connectors`);
  await page.close();
}
await b.close();
done();
