// Full check-over, part 3: real end-to-end runs, started by clicking through the panel like Nic would.
// Uses Claude for real (small jobs) and opens real pull requests on the project you pick. Dev copy only.
// Usage: BASE_URL=http://127.0.0.1:3253 PROJECT=arcade node scripts/qa/e2e.mjs <scenario> [shotsDir]
//   quick     Quick task from the New task panel (set RESTART_CMD to also restart the panel mid-run)
//   careful   Careful task, with a pretend usage-limit wait in the middle that resumes by itself
//   template  Workflow from the Research report template, Test run
//   coach     Workflow from the start screen with a vague one-line goal, through the prompt coach,
//             then changed in my own words (Draft the change → Apply), Test run
//   follow    Keep watching a workflow run started earlier: follow <shotsDir> <workflowId> <runId>
//   brief     Workflow from the start screen with an attached brief, Test run
// Each one must finish and show up in the Inbox.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3100";
const PROJECT = process.env.PROJECT || "arcade";
const which = process.argv[2];
const shots = process.argv[3] || "/tmp/agentbox-e2e";
fs.mkdirSync(shots, { recursive: true });
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1366, height: 900 } });
await page.request.post(`${BASE}/api/settings`, { data: { tourDone: true } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const say = (m) => console.log(`[${new Date().toLocaleTimeString()}] ${m}`);
const shot = (n) => page.screenshot({ path: `${shots}/${which}-${n}.png`, fullPage: true }).catch(() => {});
const get = async (p) => (await page.request.get(BASE + p)).json();
const until = async (what, fn, mins = 60) => {
  const end = Date.now() + mins * 60_000;
  let last = "";
  for (;;) {
    const v = await fn().catch((e) => (String(e), null));
    if (v && v !== true && typeof v === "object" && v.note) { if (v.note !== last) say(`  … ${(last = v.note)}`); }
    else if (v) return v;
    if (Date.now() > end) throw new Error(`gave up waiting for: ${what}`);
    await new Promise((r) => setTimeout(r, 5000));
  }
};
let failed = 0;
const check = (ok, what) => (console.log(`${ok ? "✓" : "✗"} ${what}`), ok || failed++);

// The prompt coach: answer its quick questions (first choice each), take the improved version, carry on.
async function coach(doneLabel) {
  const box = page.locator("section[aria-labelledby=coach-h]");
  await box.waitFor({ timeout: 30_000 });
  const h = box.locator("h2");
  await page.waitForFunction(() => !/Checking your goal/.test(document.querySelector("#coach-h")?.textContent || ""), null, { timeout: 120_000 });
  const title = await h.textContent();
  say(`coach: ${title}`);
  if (/quick questions/.test(title)) {
    await shot("coach-questions");
    for (const fs_ of await box.locator("fieldset").all()) await fs_.locator("label").first().click();
    await box.getByRole("button", { name: "Improve my goal" }).click();
    await box.getByRole("button", { name: new RegExp(`^Use this and ${doneLabel}`, "i") }).waitFor({ timeout: 120_000 });
    await shot("coach-improved");
    await box.getByRole("button", { name: new RegExp(`^Use this and ${doneLabel}`, "i") }).click();
    return "improved";
  }
  if (/improved version/.test(title)) {
    await box.getByRole("button", { name: new RegExp(`^Use this and ${doneLabel}`, "i") }).click();
    return "improved";
  }
  await box.getByRole("button", { name: new RegExp(`^${doneLabel}`, "i") }).first().click();
  return "looks good";
}

async function inboxHas(pred) {
  const j = await get("/api/inbox");
  return j.items.find(pred) ?? null;
}

async function startTask(goal, thorough) {
  await page.goto(BASE + "/");
  await page.getByRole("button", { name: "New task" }).click();
  const d = page.locator("dialog[open]");
  await d.getByRole("textbox", { name: "What should it do?" }).fill(goal);
  await d.getByRole("combobox", { name: "Project" }).selectOption(PROJECT);
  await d.locator("label", { hasText: thorough }).click();
  await d.getByRole("button", { name: "Start", exact: true }).click();
  const how = await coach("start");
  await page.waitForURL(/\/agents\/\d+/, { timeout: 60_000 });
  const id = Number(page.url().match(/agents\/(\d+)/)[1]);
  say(`started agent ${id} (coach: ${how})`);
  return id;
}

async function waitTask(id) {
  return until("the task to finish", async () => {
    const s = await get(`/api/agents/${id}/state`);
    const r = s.runs?.[0];
    if (!r) return { note: "no run yet" };
    if (["review", "done", "stopped"].includes(r.status) && !s.view.activeRun) return r;
    return { note: `${r.status} · ${s.view.activeRun?.activity ?? ""}` };
  });
}

async function newWorkflow(goal, { brief, template } = {}) {
  await page.goto(BASE + "/workflows/new");
  await page.getByRole("textbox", { name: "What do you want to make?" }).fill(goal);
  await page.getByRole("combobox", { name: "Project" }).first().selectOption(PROJECT);
  if (brief) {
    const [fc] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Upload a file" }).first().click()]);
    await fc.setFiles(brief);
    await page.getByText(/Brief: /).first().waitFor();
  }
  if (template) {
    await page.getByRole("button", { name: "Change the steps" }).click();
    await page.getByRole("button", { name: new RegExp(template) }).first().click();
  }
  await shot("start-screen");
  await page.getByRole("button", { name: "Next" }).click();
  const how = await coach("next");
  await page.waitForURL(/\/workflows\/\d+/, { timeout: 60_000 });
  const id = Number(page.url().match(/workflows\/(\d+)/)[1]);
  say(`made workflow ${id} (coach: ${how})`);
  return id;
}

async function testRun(id) {
  await page.goto(`${BASE}/workflows/${id}`);
  await page.getByRole("button", { name: "Test run", exact: true }).click();
  const wr = await until("the run to start", async () => (await get(`/api/workflows/${id}/state`)).runs?.[0] ?? null, 2);
  say(`test run ${wr.id} started`);
  return wr.id;
}

async function waitWf(id, wrId) {
  if (process.env.RESTART_CMD) {
    // Restart the panel while a step is really working, then check the run picks up again.
    await until("a step to be working", async () => {
      const r = (await get(`/api/workflows/${id}/state`)).runs.find((x) => x.id === wrId);
      const step = r.steps[r.current];
      return r.current >= 1 && r.stepRuns[step.id]?.state === "now" ? true : { note: `step ${r.current + 1}: ${r.stepRuns[step?.id]?.state ?? "?"}` };
    }, 10);
    await page.waitForTimeout(20_000);
    say("restarting the panel mid-run…");
    spawn(process.env.RESTART_CMD, { shell: true, detached: true, stdio: "ignore" }).unref();
    await new Promise((r) => setTimeout(r, 3000));
    await until("the panel to come back", async () => (await page.request.get(BASE + "/api/ping")).ok(), 10);
    const r = (await get(`/api/workflows/${id}/state`)).runs.find((x) => x.id === wrId);
    check(["running", "queued", "done", "needs"].includes(r.status), `after the restart the workflow run is still going (${r.status}, step ${r.current + 1})`);
  }
  return until("the workflow run to finish", async () => {
    const s = await get(`/api/workflows/${id}/state`);
    const r = s.runs.find((x) => x.id === wrId);
    if (["done", "stopped", "needs"].includes(r.status)) return r;
    const step = r.steps[r.current];
    return { note: `${r.status} · step ${r.current + 1}: ${step?.type} ${r.stepRuns[step?.id]?.note ?? ""}` };
  }, 90);
}

async function landed(kindOk, pred, label) {
  const item = await until("the Inbox item", async () => (await inboxHas(pred)) ?? { note: "not in the Inbox yet" }, 3);
  check(kindOk(item), `${label}: in the Inbox as "${item.kind}" — ${String(item.text ?? "").slice(0, 120)}`);
  await page.goto(BASE + "/inbox");
  await page.waitForTimeout(1500);
  await shot("inbox");
  return item;
}

try {
  if (which === "quick") {
    const id = await startTask("Add one line at the very bottom of README.md that says: Checked by agentbox on a test run. Change nothing else.", "Quick");
    await until("it to be working", async () => ((await get(`/api/agents/${id}/state`)).view.activeRun?.status === "working" ? true : { note: "waiting to start" }), 5);
    await page.waitForTimeout(20_000);
    await shot("working");
    if (process.env.RESTART_CMD) {
      say("restarting the panel mid-run…");
      spawn(process.env.RESTART_CMD, { shell: true, detached: true, stdio: "ignore" }).unref();
    await new Promise((r) => setTimeout(r, 3000));
      await until("the panel to come back", async () => (await page.request.get(BASE + "/api/ping")).ok(), 10);
      const s = await get(`/api/agents/${id}/state`);
      check(!!s.view.activeRun || ["review", "done"].includes(s.runs[0].status), `after the restart the run carries on (${s.runs[0].status} · ${s.view.activeRun?.activity ?? ""})`);
    }
    const r = await waitTask(id);
    check(r.status === "review" && !!r.prUrl, `quick task finished with a pull request (${r.status}, ${r.prUrl ?? "no PR"})`);
    await page.goto(`${BASE}/agents/${id}`);
    await shot("agent-done");
    await landed((i) => i.kind === "pr", (i) => i.runId === r.id, "quick task");
  }

  if (which === "careful") {
    const id = await startTask("Add a short comment at the top of index.html that says: Arcade home page. Change nothing else.", "Careful");
    const run = await until("it to be working", async () => {
      const s = await get(`/api/agents/${id}/state`);
      return s.view.activeRun?.status === "working" && s.view.activeRun?.extra?.proc ? s.view.activeRun : { note: s.view.activeRun?.activity ?? "waiting to start" };
    }, 5).catch(async () => (await get(`/api/agents/${id}/state`)).view.activeRun);
    await page.waitForTimeout(15_000);
    const sim = await page.request.post(`${BASE}/api/dev/simulate`, { data: { runId: run.id, what: "usage", seconds: 45 } });
    check(sim.ok(), `pretended the usage limit was reached (${sim.status()})`);
    const waiting = await until("it to wait for usage", async () => {
      const s = await get(`/api/agents/${id}/state`);
      return /Waiting · back at/.test(s.view.activeRun?.activity ?? "") ? s.view.activeRun : { note: s.view.activeRun?.activity ?? "?" };
    }, 2);
    await page.goto(`${BASE}/agents/${id}`);
    await shot("usage-wait");
    check(!!waiting, `it waits: "${waiting.activity}"`);
    await until("it to carry on by itself", async () => {
      const s = await get(`/api/agents/${id}/state`);
      return s.view.activeRun?.status === "working" || !s.view.activeRun ? true : { note: s.view.activeRun?.activity };
    }, 5);
    say("it carried on after the wait");
    const r = await waitTask(id);
    check(r.status === "review" && !!r.prUrl, `careful task finished with a pull request (${r.status}, ${r.prUrl ?? "no PR"})`);
    await page.goto(`${BASE}/agents/${id}`);
    await shot("agent-done");
    await landed((i) => i.kind === "pr" && !!i.careful, (i) => i.runId === r.id, "careful task");
  }

  if (which === "template") {
    const id = await newWorkflow("Write a short report: three tips for making a small browser game feel fun on a phone.", { template: "Research report" });
    const wrId = await testRun(id);
    const r = await waitWf(id, wrId);
    check(r.status === "done", `template workflow finished (${r.status}: ${r.summary ?? r.stopReason})`);
    await page.goto(`${BASE}/workflows/${id}?run=${wrId}`);
    await shot("run-done");
    await landed(() => true, (i) => i.wfRunId === wrId, "template workflow");
  }

  if (which === "follow") {
    // Pick up a workflow run started earlier: node e2e.mjs follow <shots> <workflowId> <runId>
    const [id, wrId] = process.argv.slice(4).map(Number);
    delete process.env.RESTART_CMD;
    const r = await waitWf(id, wrId);
    check(r.status === "done", `workflow run ${wrId} finished (${r.status}: ${r.summary ?? r.stopReason})`);
    await page.goto(`${BASE}/workflows/${id}?run=${wrId}`);
    await shot("run-done");
    await landed(() => true, (i) => i.wfRunId === wrId, `workflow run ${wrId}`);
  }

  if (which === "coach") {
    const id = await newWorkflow("make a joke page");
    await page.getByRole("textbox", { name: "Change it in your own words" }).fill("Make the review step use the fast model and keep it to 10 minutes.");
    await page.getByRole("button", { name: "Draft the change" }).click();
    await page.getByRole("button", { name: "Apply", exact: true }).waitFor({ timeout: 120_000 });
    await shot("change-preview");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await page.waitForTimeout(1500);
    const w = (await get(`/api/workflows/${id}/state`)).workflow;
    const review = w.steps.find((s) => s.type === "review");
    check(review && review.model === "sonnet", `the change was applied (review model: ${review?.model}, ${review?.maxMinutes} min)`);
    const wrId = await testRun(id);
    const r = await waitWf(id, wrId);
    check(r.status === "done", `coached workflow finished (${r.status}: ${r.summary ?? r.stopReason})`);
    await page.goto(`${BASE}/workflows/${id}?run=${wrId}`);
    await shot("run-done");
    await landed(() => true, (i) => i.wfRunId === wrId, "coached workflow");
  }

  if (which === "brief") {
    const f = `${shots}/TINY-BRIEF.md`;
    fs.writeFileSync(f, "# Tiny brief\n\nAdd a file called credits.txt in the project root with exactly one line:\n\nMade with agentbox (test run)\n\nDon't change anything else.\n");
    const id = await newWorkflow("Follow TINY-BRIEF.md.", { brief: f });
    const wrId = await testRun(id);
    const r = await waitWf(id, wrId);
    check(r.status === "done", `brief workflow finished (${r.status}: ${r.summary ?? r.stopReason})`);
    await page.goto(`${BASE}/workflows/${id}?run=${wrId}`);
    await page.waitForTimeout(1500);
    const told = await page.getByText(/TINY-BRIEF\.md/).count();
    check(told > 0, "the run page shows the brief it was given");
    await shot("run-done");
    await landed(() => true, (i) => i.wfRunId === wrId, "brief workflow");
  }
} catch (e) {
  check(false, `${which}: ${e.message}`);
  await shot("error");
}
check(errors.length === 0, `no page errors${errors.length ? `: ${errors.slice(0, 2).join(" | ")}` : ""}`);
await b.close();
process.exit(failed ? 1 : 0);
