// Milestone 4: busy tiles, Shipped in the Inbox, Discord settings, clearer workflows. Laptop and phone.
import { BASE, api, browser, done, newPage, ok, pageCheck, shot, waitFor } from "./lib.mjs";
const wf = Number(process.argv[2]);
const b = await browser();
for (const size of ["laptop", "phone"]) {
  const page = await newPage(b, size);
  // A workflow test run, so its tile shows the step it's on.
  await page.goto(`${BASE}/workflows`, { waitUntil: "load" });
  await api(page, `/api/workflows/${wf}/run`, { test: true, input: `Count the games, then list each game's file size (${size})` });
  ok(await page.getByText(/Step \d of \d: (Look|Build)/).first().waitFor({ timeout: 20_000 }).then(() => true).catch(() => false), `${size}: a running workflow tile says which step it's on`);
  await shot(page, `m4-${size}-workflows`);
  await pageCheck(page, `${size} workflows`);

  await page.goto(`${BASE}/inbox`, { waitUntil: "load" });
  await page.getByRole("button", { name: "Done & shipped" }).click();
  ok(await page.getByText("Arcade home footer").first().isVisible(), `${size}: "Shipped" item under Done & shipped`);
  ok(await page.getByRole("link", { name: /Play/ }).first().isVisible(), `${size}: shipped item has Play`);
  ok(await page.getByText("New", { exact: true }).first().isVisible(), `${size}: unopened ship is marked New`);
  await shot(page, `m4-${size}-inbox-shipped`);
  await pageCheck(page, `${size} inbox shipped`);
  await page.getByRole("button", { name: "Reports" }).click();
  ok(await page.getByText("No reports yet").isVisible(), `${size}: Reports filter has an empty state`);

  await page.goto(`${BASE}/settings`, { waitUntil: "load" });
  ok(await page.getByText("Ping me when something ships").isVisible(), `${size}: Discord ping switch in Settings`);
  await page.getByRole("button", { name: "Send a test message" }).click();
  ok(await page.getByText("Sent. Check Discord.").waitFor({ timeout: 10_000 }).then(() => true).catch(() => false), `${size}: test message (dev copy: logged, not really sent)`);
  ok(await page.getByText("Test message from agentbox").first().isVisible(), `${size}: it shows in Last messages`);
  await pageCheck(page, `${size} settings`);

  await page.goto(`${BASE}/workflows/${wf}`, { waitUntil: "load" });
  await waitFor(async () => !(await api(page, "/api/workflows/state")).json?.tiles?.find((t) => t.id === wf)?.current, 60_000);
  await page.reload({ waitUntil: "load" });
  const box = page.getByRole("textbox", { name: "What should this workflow make?" });
  ok((await box.inputValue()).includes("how many games"), `${size}: "What should this workflow make?" box at the top`);
  await page.getByRole("button", { name: "Test run" }).click();
  ok((await page.getByRole("dialog").getByRole("textbox").inputValue()).includes("how many games"), `${size}: Test run is prefilled with it (and editable)`);
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: /^Step 2: Look/ }).first().click();
  ok(await page.getByText("This step's instructions").isVisible(), `${size}: step instructions clearly labeled`);
  ok(await page.getByRole("group", { name: /Freedom/ }).isVisible(), `${size}: steps use the same Freedom control`);
  await shot(page, `m4-${size}-workflow-step`);
  await pageCheck(page, `${size} workflow editor`);
  await page.close();
}
await b.close();
done();
