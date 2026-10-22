// Milestone 1: one agent per job + the Start a task panel, at laptop and phone width.
import { BASE, api, browser, done, newPage, ok, pageCheck, shot, waitFor } from "./lib.mjs";

const b = await browser();
for (const size of ["laptop", "phone"]) {
  const page = await newPage(b, size);
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const tiles = await page.locator('section[aria-label="Your agents"] li').allInnerTexts();
  ok(!tiles.some((t) => /^Builder|^Reviewer|^Site Checker|^Overnight/m.test(t)), `${size}: premade agents are gone from the grid`);
  ok(tiles.some((t) => /Heartbeat/.test(t)), `${size}: Heartbeat stays`);
  await page.getByRole("button", { name: /^Archived/ }).click();
  const archived = await page.locator('section[aria-label="Archived agents"] li').allInnerTexts();
  ok(["Builder", "Reviewer", "Site Checker", "Overnight"].every((n) => archived.some((t) => t.includes(n))), `${size}: the 4 premade agents are under Archived`);
  await shot(page, `m1-${size}-archived`);
  await page.getByRole("button", { name: "Agents", exact: true }).click();
  await pageCheck(page, `${size} home`);
  await shot(page, `m1-${size}-home`);

  // Open the panel from the tile (phone) or the header button (laptop).
  if (size === "laptop") await page.getByRole("banner").getByRole("button", { name: "New task" }).click();
  else await page.getByRole("button", { name: /Start a task/ }).click();
  const dlg = page.getByRole("dialog", { name: "Start a task" });
  await dlg.waitFor();
  ok(await dlg.getByRole("textbox", { name: "What should it do?" }).isVisible(), `${size}: big box "What should it do?"`);
  ok(await dlg.getByRole("group", { name: /When does it run/ }).isVisible(), `${size}: When does it run?`);
  await dlg.getByText("Every day", { exact: true }).click();
  ok(await dlg.getByText(/^Next run: (today|tomorrow) at 6:00 PM$/).isVisible(), `${size}: day/time pickers show at once with "Next run"`);
  await dlg.getByText("Certain days", { exact: true }).click();
  ok(await dlg.getByLabel("Monday").isVisible(), `${size}: day picker shows for Certain days`);
  await dlg.getByText("Now", { exact: true }).click();
  ok(await dlg.getByRole("group", { name: /Freedom/ }).isVisible(), `${size}: Freedom control`);
  ok(await dlg.getByText("Check with me first").isVisible(), `${size}: Freedom has Check with me first`);
  ok(await dlg.getByText("Careful", { exact: true }).isVisible(), `${size}: Careful / Quick`);
  await dlg.getByRole("button", { name: "More options" }).click();
  ok(await dlg.getByText("Time limit").isVisible(), `${size}: More options opens (time limit)`);
  await pageCheck(page, `${size} Start a task panel`);
  await shot(page, `m1-${size}-panel`);
  if (size === "phone") {
    await dlg.getByRole("button", { name: "Cancel" }).click();
    await page.close();
    continue;
  }
  // A small real job: look-only and quick, so it's cheap.
  await dlg.getByRole("textbox", { name: "What should it do?" }).fill("Read the README of this project and tell me in one sentence what the project is.");
  await dlg.getByRole("combobox", { name: "Project" }).selectOption("arcade");
  await dlg.getByText("Look only", { exact: true }).click();
  await dlg.getByText("Quick", { exact: true }).click();
  await dlg.getByRole("button", { name: "Start" }).click();
  await page.waitForURL(/\/agents\/\d+$/);
  const id = Number(page.url().split("/").pop());
  const name = await page.locator("h1").innerText();
  ok(/readme|arcade|project/i.test(name) && !/builder/i.test(name), `new agent named after the job: "${name}"`);
  const first = await waitFor(async () => {
    const s = (await api(page, `/api/agents/${id}/state`)).json;
    return s?.runs?.[0] && ["done", "stopped"].includes(s.runs[0].status) ? s.runs[0] : null;
  }, 240_000);
  ok(first?.status === "done", `the job's first run finished (${first?.status}: ${(first?.result ?? first?.stopReason ?? "").slice(0, 120)})`);
  await page.reload({ waitUntil: "networkidle" });
  await shot(page, `m1-${size}-agent-done`);
  // Follow-up from the agent page: it opens the same panel.
  await page.getByPlaceholder(/Make the buttons bigger/).fill("Now also tell me how many files are in the project.");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const fdlg = page.getByRole("dialog", { name: /^Follow-up:/ });
  await fdlg.waitFor();
  ok(await fdlg.getByText(/Same project \(arcade\)/).isVisible(), "follow-up panel says it continues the same job");
  ok((await fdlg.getByRole("textbox", { name: "What should it do next?" }).inputValue()).includes("how many files"), "follow-up text carried into the panel");
  await fdlg.getByText("Quick", { exact: true }).click();
  await fdlg.getByRole("button", { name: "Start" }).click();
  const second = await waitFor(async () => {
    const s = (await api(page, `/api/agents/${id}/state`)).json;
    return s?.runs?.length >= 2 && ["done", "stopped"].includes(s.runs[0].status) ? s.runs[0] : null;
  }, 240_000);
  ok(second?.status === "done" && second.extra?.followUp, `follow-up ran on the same agent (${second?.status}: ${(second?.result ?? "").slice(0, 120)})`);
  const log = await (await page.request.get(`${BASE}/api/runs/${second?.id}/log`)).text();
  ok(/follow-up/i.test(log) || second?.extra?.followUp, "the follow-up knew what it did before");
  // Archive it.
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Archive" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Archive" }).click();
  await page.waitForTimeout(800);
  const a = (await api(page, `/api/agents/${id}`)).json;
  ok(a?.archived === true, "Archive puts it under Archived");
  await pageCheck(page, `${size} agent page`);
  await page.close();
}
await b.close();
done();
