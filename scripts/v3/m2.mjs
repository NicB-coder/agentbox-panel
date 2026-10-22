// Milestone 2 UI checks: Ran out of time → Keep going, Careful line in the Inbox, big job page, both widths.
import { BASE, api, browser, done, newPage, ok, pageCheck, shot, waitFor } from "./lib.mjs";
const [agentId, runId, bigAgent] = process.argv.slice(2).map(Number);
const b = await browser();
for (const size of ["phone", "laptop"]) {
  const page = await newPage(b, size);
  await page.goto(`${BASE}/inbox`, { waitUntil: "networkidle" });
  ok(await page.getByText("Ran out of time").first().isVisible(), `${size}: Inbox shows "Ran out of time" (not a red failure)`);
  ok(await page.getByText(/Reviewed ✓ · optimized|Reviewed ✓/).first().isVisible(), `${size}: Inbox shows the Careful line`);
  ok(await page.getByRole("button", { name: "Keep going (+30 min)" }).first().isVisible(), `${size}: Keep going button`);
  await pageCheck(page, `${size} inbox`);
  await shot(page, `m2-${size}-inbox`);
  await page.goto(`${BASE}/agents/${bigAgent}`, { waitUntil: "networkidle" });
  await pageCheck(page, `${size} big job page`);
  await shot(page, `m2-${size}-bigjob`);
  await page.goto(`${BASE}/agents/${agentId}`, { waitUntil: "networkidle" });
  await shot(page, `m2-${size}-outoftime`);
  if (size === "laptop") {
    await page.getByRole("button", { name: "Keep going (+30 min)" }).click();
    const r = await waitFor(async () => {
      const s = (await api(page, `/api/agents/${agentId}/state`)).json;
      return s?.runs?.[0]?.id === runId && s.runs[0].status !== "stopped" ? s.runs[0] : null;
    }, 30_000);
    ok(r && ["working", "review", "done"].includes(r.status), `Keep going continues the same run (${r?.status})`);
    await pageCheck(page, `${size} agent page working`);
  }
  await page.close();
}
await b.close();
done();
