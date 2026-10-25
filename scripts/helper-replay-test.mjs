// Browser test for the Helper (v3.1): saved replies never replay, a request is sent once per message,
// and the bubble follows Nic into every pop-up and panel without covering buttons.
//   node scripts/helper-replay-test.mjs http://127.0.0.1:3253 [shots-folder] [real]
// Without "real" it uses a canned conversation (no Claude usage). With "real" it also sends one real
// question and clicks around while the reply is being written, and asks the Helper to improve a goal
// in the Start a task panel (two Helper replies of usage). Run it against a dev copy, never the live panel.
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.argv[2] ?? "http://127.0.0.1:3100";
const SHOTS = process.argv[3] && process.argv[3] !== "real" ? process.argv[3] : "";
const REAL = process.argv.includes("real");
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, more = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${more ? `  (${more})` : ""}`);
};

const long = (n) =>
  `Your [[workflow:1|Build → Review → Ship]] workflow is Off right now. ${"It builds the thing, has it reviewed, then asks you before shipping. ".repeat(n)}Press Test run to try it safely.`;
const now = Date.now();
const CANNED = {
  chat: { id: 9001, title: "Canned", createdAt: now, updatedAt: now },
  chats: [{ id: 9001, title: "Canned", createdAt: now, updatedAt: now }],
  outOfUsage: null,
  suggestions: ["What's running right now?", "What needs me?"],
  messages: [1, 2, 3].flatMap((i) => [
    { id: 90000 + i * 2, chatId: 9001, role: "user", text: `Question ${i}`, status: "done", meta: { context: "Agents" }, createdAt: now },
    { id: 90001 + i * 2, chatId: 9001, role: "helper", text: long(3 + i * 2), status: "done", meta: { chips: { "workflow:1": { href: "/workflows/1", label: "Build → Review → Ship" } } }, createdAt: now },
  ]),
};

const b = await chromium.launch();

async function bubbleBox(p) {
  return p.evaluate(() => {
    const el = document.querySelector("[data-helper-bubble]");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const top = document.elementFromPoint(cx, cy);
    // Buttons, links and boxes of the page or pop-up that the bubble sits on top of.
    const covered = [];
    const host = el.closest("dialog") ?? document;
    for (const x of host.querySelectorAll("button, a[href], input, select, textarea, [role=radio]")) {
      if (x.closest("[data-helper-root]")) continue;
      const q = x.getBoundingClientRect();
      if (!q.width || !q.height) continue;
      if (!(q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top)) continue;
      // Only count it if it's really showing there (not scrolled under the pop-up's bottom bar).
      const ix = (Math.max(q.left, r.left) + Math.min(q.right, r.right)) / 2;
      const iy = (Math.max(q.top, r.top) + Math.min(q.bottom, r.bottom)) / 2;
      const under = document.elementsFromPoint(ix, iy).find((n) => !n.closest("[data-helper-root]"));
      if (under && (x.contains(under) || under.contains(x))) covered.push((x.textContent || x.getAttribute("aria-label") || x.tagName).trim().slice(0, 40));
    }
    const avoid = [...document.querySelectorAll("[data-helper-avoid]")].map((a) => a.getBoundingClientRect()).filter((q) => q.width);
    const onPanel = avoid.some((q) => q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top);
    return { visible: r.width > 0 && getComputedStyle(el).display !== "none", clickable: !!top && (top === el || el.contains(top)), covered, onPanel, inDialog: !!el.closest("dialog") };
  });
}

// Open the chat (it may already be open: an open chat stays open across pages on a laptop).
async function ensureOpen(p) {
  await p.locator("[data-helper-bubble]").waitFor({ state: "attached" });
  if ((await p.locator('section[role="dialog"]').count()) === 0) await p.locator("[data-helper-bubble]").click();
  await p.locator('[aria-label="Conversation"]').waitFor();
}
const convoText = (p) => p.locator('[aria-label="Conversation"]').innerText();
const writing = (p) => p.locator('[aria-label="Conversation"] [role=status]').count();

for (const [label, vp] of [["laptop", { width: 1366, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: vp });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  p.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));

  // ---- 1. Saved replies are static: open / click / focus / close / page change / panels, 20 times ----
  let sends = 0;
  let streams = 0;
  await p.route(/\/api\/helper(\?.*)?$/, (r) => {
    const u = new URL(r.request().url());
    if (r.request().method() !== "GET") return r.continue();
    const body = u.searchParams.get("only") === "suggestions" ? { suggestions: CANNED.suggestions } : CANNED;
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await p.route(/\/api\/helper\/send/, (r) => (sends++, r.abort()));
  await p.route(/\/api\/helper\/stream/, (r) => (streams++, r.abort()));
  await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await p.evaluate(() => sessionStorage.removeItem("agentbox:helper-open"));
  const bubble = p.locator("[data-helper-bubble]");
  await bubble.click();
  await p.locator('[aria-label="Conversation"]').waitFor();
  const first = await convoText(p);
  let same = 0;
  let noTyping = 0;
  const pages = ["/workflows", "/inbox", "/projects", "/"];
  for (let i = 0; i < 20; i++) {
    // click inside the chat, focus the box, close, move page (or open a panel), open again
    await ensureOpen(p);
    await p.locator('[aria-label="Conversation"] li').nth(i % 6).click({ position: { x: 10, y: 10 } });
    await p.getByLabel("Ask the Helper").focus();
    await p.getByRole("button", { name: "Close the Helper" }).first().click();
    if (i % 4 === 3) {
      await p.evaluate(() => window.dispatchEvent(new CustomEvent("agentbox:task-panel", { detail: {} })));
      await p.waitForTimeout(150);
      await ensureOpen(p);
      if ((await convoText(p)) === first) same++;
      if ((await writing(p)) === 0) noTyping++;
      await p.keyboard.press("Escape"); // closes the chat, not the panel
      await p.keyboard.press("Escape"); // now the panel
      await p.waitForTimeout(100);
      continue;
    }
    const path = pages[i % pages.length];
    await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" }).catch(() => {});
    await ensureOpen(p);
    if ((await convoText(p)) === first) same++;
    if ((await writing(p)) === 0) noTyping++;
  }
  check(`${label}: saved replies show the same finished text after 20 open/click/focus/close/page changes`, same === 20, `${same}/20`);
  check(`${label}: nothing types out again (no "Writing…")`, noTyping === 20, `${noTyping}/20`);
  check(`${label}: no request sent and no reply re-streamed`, sends === 0 && streams === 0, `sends ${sends}, streams ${streams}`);
  await p.unrouteAll({ behavior: "ignoreErrors" });
  if ((await p.locator('section[role="dialog"]').count()) > 0) await p.getByRole("button", { name: "Close the Helper" }).first().click();

  // ---- 2. The bubble follows into the Start a task panel ----
  await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await p.evaluate(() => sessionStorage.removeItem("agentbox:helper-open"));
  await p.reload({ waitUntil: "networkidle" });
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("agentbox:task-panel", { detail: {} })));
  await p.getByRole("heading", { name: "Start a task" }).waitFor();
  await p.waitForTimeout(400);
  let bx = await bubbleBox(p);
  check(`${label}: bubble shows on top of the Start a task panel and can be clicked`, !!bx?.visible && bx.clickable && bx.inDialog);
  check(`${label}: bubble covers none of the panel's buttons`, bx?.covered.length === 0, bx?.covered.join(", "));
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/${label}-task-panel-bubble.png` });
  await p.getByRole("textbox", { name: "What should it do?" }).fill("make a game");
  await p.locator("[data-helper-bubble]").click();
  await p.getByRole("group", { name: "Suggested questions" }).waitFor();
  await p.waitForTimeout(700);
  const sugg = await p.getByRole("group", { name: "Suggested questions" }).innerText();
  check(`${label}: suggestions follow the open panel`, /Is my goal detailed enough\?/.test(sugg) && /Freedom/.test(sugg), sugg.replace(/\n/g, " · "));
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/${label}-task-panel-chat.png` });

  if (REAL && label === "laptop") {
    await p.getByLabel("Ask the Helper").fill("Make my goal better");
    await p.getByRole("button", { name: "Send" }).click();
    const use = p.getByRole("button", { name: "Use this" });
    await use.waitFor({ timeout: 150_000 }).catch(() => {});
    const has = (await use.count()) > 0;
    check("laptop (real): Make my goal better shows a preview with Use this", has);
    const before = await p.getByRole("textbox", { name: "What should it do?" }).inputValue();
    check("laptop (real): the form isn't changed before the click", before === "make a game");
    if (has) {
      await use.click();
      const after = await p.getByRole("textbox", { name: "What should it do?" }).inputValue();
      check("laptop (real): Use this fills the goal box", after.length > 30 && after !== "make a game", after.slice(0, 80));
    }
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/${label}-use-this.png` });
  }
  await p.keyboard.press("Escape");
  await p.waitForTimeout(150);
  check(`${label}: Escape in the chat closes the chat and leaves the panel open`, (await p.getByRole("heading", { name: "Start a task" }).isVisible()) && (await p.locator('section[role="dialog"]').count()) === 0);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(200);
  bx = await bubbleBox(p);
  check(`${label}: bubble goes back to the page when the panel closes`, !!bx?.visible && !bx.inDialog && bx.clickable);

  // ---- 3. The workflow step panel: the bubble steps around it ----
  await p.goto(`${BASE}/workflows/1`, { waitUntil: "networkidle" });
  const step = p.locator("[data-step-id], [data-step]").first();
  if ((await step.count()) > 0) await step.click();
  else await p.getByRole("button", { name: /Review/ }).first().click();
  await p.locator("[data-helper-avoid]").waitFor({ timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(500);
  bx = await bubbleBox(p);
  const hasPanel = (await p.locator("[data-helper-avoid]").count()) > 0;
  check(`${label}: with a step's settings open the bubble is still there, beside it, not on it`, hasPanel && !!bx?.visible && bx.clickable && !bx.onPanel, hasPanel ? "" : "no step panel opened");
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/${label}-step-panel.png` });

  // ---- 4. Every other pop-up: the bubble is on top, clickable and covers no button ----
  const popups = [
    ["the brief viewer inside Start a task", async () => {
      await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await p.evaluate(() => window.dispatchEvent(new CustomEvent("agentbox:task-panel", { detail: {} })));
      await p.getByRole("heading", { name: "Start a task" }).waitFor();
      await p.getByRole("button", { name: "View" }).first().click();
    }],
    ["the Are you sure? box of Pause everything", async () => {
      await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
      if (label === "phone") await p.getByRole("button", { name: "Menu" }).click();
      await p.getByRole("button", { name: "Pause everything" }).last().click();
    }],
    ...(label === "phone"
      ? [["the phone Menu", async () => {
          await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
          await p.getByRole("button", { name: "Menu" }).click();
        }]]
      : []),
  ];
  for (const [name, openIt] of popups) {
    try {
      await openIt();
      await p.waitForTimeout(500);
      const box = await bubbleBox(p);
      check(`${label}: on ${name} the bubble is on top, clickable, covering no button`, !!box?.visible && box.clickable && box.inDialog && box.covered.length === 0, box?.covered.join(", "));
      if (SHOTS) await p.screenshot({ path: `${SHOTS}/${label}-${name.replace(/\W+/g, "-")}.png` });
      await p.keyboard.press("Escape");
      await p.keyboard.press("Escape");
    } catch (e) {
      check(`${label}: on ${name} the bubble is on top`, false, String(e).slice(0, 120));
    }
  }

  check(`${label}: no errors on the page`, errs.length === 0, errs.slice(0, 3).join(" | "));
  await p.close();
}

// ---- 4. A real reply: clicking around while it's written never replays it ----
if (REAL) {
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  let sends = 0;
  p.on("request", (r) => r.url().includes("/api/helper/send") && sends++);
  await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await p.locator("[data-helper-bubble]").click();
  await p.getByRole("button", { name: "New chat" }).click();
  await p.waitForTimeout(300);
  await p.getByLabel("Ask the Helper").fill("What does Careful mean? Answer in 3 sentences.");
  await p.keyboard.press("Enter");
  await p.keyboard.press("Enter"); // a double press sends once
  let shrank = 0;
  let last = 0;
  for (let i = 0; i < 12; i++) {
    await p.waitForTimeout(700);
    await p.getByRole("button", { name: "Close the Helper" }).first().click();
    await p.waitForTimeout(150);
    await p.locator("[data-helper-bubble]").click();
    await p.locator('[aria-label="Conversation"]').waitFor();
    const t = (await p.locator('[aria-label="Conversation"] li').last().innerText()).length;
    if (t + 5 < last) shrank++;
    last = Math.max(last, t);
  }
  await p.locator('[aria-label="Conversation"] [role=status]').waitFor({ state: "detached", timeout: 150_000 });
  check("real: while a reply is written, closing and opening never starts it over", shrank === 0, `${shrank} times shorter`);
  const done = await convoText(p);
  let streams = 0;
  p.on("request", (r) => r.url().includes("/api/helper/stream") && streams++);
  let same = 0;
  for (let i = 0; i < 20; i++) {
    await p.locator('[aria-label="Conversation"] li').last().click({ position: { x: 5, y: 5 } });
    await p.getByLabel("Ask the Helper").focus();
    await p.getByRole("button", { name: "Close the Helper" }).first().click();
    if (i % 2) await p.goto(`${BASE}${["/inbox", "/workflows", "/"][i % 3]}`, { waitUntil: "domcontentloaded" });
    await ensureOpen(p);
    if ((await convoText(p)) === done && (await writing(p)) === 0) same++;
  }
  check("real: after it finished, 20 rounds of click/focus/close/page change show identical text", same === 20, `${same}/20`);
  check("real: one question sent once (double Enter), no re-streaming afterwards", sends === 1 && streams === 0, `sends ${sends}, streams ${streams}`);
  await p.close();
}

await b.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length} of ${results.length} checks pass`);
process.exit(bad.length ? 1 : 0);
