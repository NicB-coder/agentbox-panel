// Full check-over, part 2: clicks every control on every page for real and records what it did.
// Each control gets a freshly loaded page. A click "worked" if the address changed, a pop-up opened or closed,
// the page changed, or a request went out (and didn't fail). Pop-ups that open get their own controls clicked too.
// Anything that would start a real agent run or ask Claude is stopped at the network (and counted as wired up);
// the end-to-end runs test those for real. Run it only against a dev copy: it really pauses, deletes and edits things.
// Usage: BASE_URL=http://127.0.0.1:3253 node scripts/qa/click-all.mjs out.json [laptop|phone] [/path ...]
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3100";
const out = process.argv[2] || "/tmp/agentbox-clicks.json";
const size = process.argv[3] || "laptop";
const VIEW = size === "phone" ? { width: 390, height: 844 } : { width: 1366, height: 900 };
// Things that cost Claude usage or reach GitHub: blocked here, done for real in the end-to-end runs.
const COSTLY = /\/api\/(tasks|agents\/\d+\/run|workflows\/\d+\/run|coach|helper\/(send|continue|create)|workflows\/draft|workflows\/\d+\/change|runs\/\d+\/(merge|retry|continue|send-back|ask-review|install)|workflow-runs\/\d+\/(retry|resume|answer)|file-prs|projects\/(clone|create|[^/]+\/files)|changes\/(fix|comment)|fix|update|terminal\/input)/; // Discord is off in dev copies (AGENTBOX_NO_DISCORD)
const SKIP_NAMES = /^(Delete this workflow|Delete|Remove this agent|Archive)/i; // checked by opening, then Cancel

async function discover() {
  const j = async (p) => (await fetch(BASE + p)).json().catch(() => null);
  const state = await j("/api/state");
  const wfs = await j("/api/workflows/state");
  const paths = ["/", "/inbox", "/workflows", "/workflows/new", "/projects", "/settings", "/help", "/machine", "/connectors", "/terminal", "/agents/new"];
  const agents = (state?.views ?? []).map((v) => v.agent);
  for (const a of agents.slice(0, 3)) paths.push(`/agents/${a.id}`);
  const hb = agents.find((a) => a.slug === "heartbeat");
  if (hb) paths.push(`/agents/${hb.id}`);
  if (agents[0]) paths.push(`/agents/${agents[0].id}/edit`);
  const w = wfs?.tiles?.[0];
  if (w) paths.push(`/workflows/${w.id}`);
  return paths;
}

const only = process.argv.slice(4);
const paths = only.length ? only : await discover();
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: VIEW });
await ctx.request.post(`${BASE}/api/settings`, { data: { tourDone: true } }).catch(() => {});
await ctx.route("**/api/**", (route) => {
  const r = route.request();
  if (r.method() !== "GET" && COSTLY.test(r.url())) return route.abort("blockedbyclient");
  return route.continue();
});

const LIST = `a[href], button, input:not([type=hidden]), select, textarea, [role=switch], [role=tab], summary`;
async function controls(page, scope) {
  return page.evaluate(([sel, scopeSel]) => {
    const root = scopeSel ? [...document.querySelectorAll(scopeSel)].pop() : document;
    if (!root) return [];
    const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && !el.closest("[inert]"); };
    const name = (el) => (el.getAttribute("aria-label") || (el.labels?.[0]?.textContent) || el.textContent || el.getAttribute("placeholder") || el.getAttribute("title") || el.getAttribute("name") || el.id || "").replace(/\s+/g, " ").trim().slice(0, 70);
    const all = [...root.querySelectorAll(sel)];
    // A pop-up that opens with the page (e.g. /agents/new opens Start a task): the page behind it can't be clicked.
    const modal = !scopeSel && [...document.querySelectorAll("dialog[open]")].find((d) => d.matches(":modal"));
    return all.map((el, i) => ({ i, el })).filter(({ el }) => vis(el) && (scopeSel || !el.closest("dialog[open]")) && !(modal && !modal.contains(el)))
      .map(({ i, el }) => ({ i, tag: el.tagName.toLowerCase(), type: el.getAttribute("type") || el.getAttribute("role") || "", name: name(el), href: el.getAttribute("href") || "", target: el.getAttribute("target") || "", current: el.getAttribute("aria-current") === "page" || el.getAttribute("aria-pressed") === "true" || el.getAttribute("aria-selected") === "true" || el.getAttribute("aria-checked") === "true" && el.type === "radio", disabled: el.disabled || el.getAttribute("aria-disabled") === "true" }));
  }, [LIST, scope]);
}

async function snapshot(page) {
  return page.evaluate(() => ({
    url: location.href,
    dialogs: document.querySelectorAll("dialog[open], [role=dialog]:not([hidden])").length,
    text: document.body.innerText.replace(/\d+/g, "#").length + ":" + document.body.innerText.replace(/\d+/g, "#").slice(0, 4000),
    expanded: [...document.querySelectorAll("[aria-expanded=true], details[open]")].length + "|" + [...document.querySelectorAll("[aria-pressed=true], [aria-selected=true], input:checked")].map((e) => e.textContent || e.id).join(","),
    focus: document.activeElement?.tagName,
  }));
}

async function act(page, c, scope) {
  const loc = page.locator(scope ? `${scope} >> nth=-1` : "body").locator(LIST).nth(c.i);
  if (c.tag === "a" && c.href.startsWith("#")) {
    await loc.focus(); await page.keyboard.press("Enter");
    const moved = await page.evaluate((h) => location.hash === h || document.activeElement?.id === h.slice(1) || !!document.querySelector(h), c.href);
    return { kind: "jump link", ok: moved };
  }
  if (c.tag === "a" && new URL(c.href, BASE + "/x").pathname === new URL(page.url()).pathname && !c.href.includes("?")) return { kind: "link to this page", ok: true };
  if (c.current) { await loc.click({ timeout: 4000 }); return { kind: "already chosen", ok: true }; }
  if (c.tag === "a" && c.target === "_blank" && !/^https?:/.test(c.href)) {
    const [tab] = await Promise.all([page.context().waitForEvent("page", { timeout: 5000 }), loc.click()]);
    const r = await tab.waitForLoadState("domcontentloaded").then(() => page.request.get(tab.url()));
    await tab.close();
    return { kind: "new tab", ok: r.status() < 400, note: `${c.href} → ${r.status()}` };
  }
  if (c.tag === "a" && /^https?:/.test(c.href) && !c.href.startsWith(BASE)) return { kind: "outside link", ok: true, note: c.href };
  if (c.tag === "input" && /text|search|url|email|number|^$/.test(c.type) || c.tag === "textarea") {
    if (c.type === "number") { await loc.fill("3"); } else await loc.fill("make a small change");
    const v = await loc.inputValue();
    return { kind: "typed", ok: v.length > 0 };
  }
  if (c.tag === "input" && c.type === "range") {
    const before = await loc.inputValue();
    await loc.focus(); await page.keyboard.press("ArrowRight");
    const after = await loc.inputValue();
    return { kind: "slider", ok: before !== after || after === (await loc.getAttribute("max")), note: `${before} → ${after}` };
  }
  if (c.tag === "input" && c.type === "file") return { kind: "file picker", ok: true, note: "upload tested in briefs flow" };
  if (c.tag === "select") {
    const opts = await loc.locator("option").evaluateAll((os) => os.map((o) => o.value));
    const cur = await loc.inputValue();
    const next = opts.find((o) => o !== cur);
    if (!next) return { kind: "select", ok: true, note: "only one choice" };
    await loc.selectOption(next);
    return { kind: "select", ok: (await loc.inputValue()) === next, note: `${opts.length} choices` };
  }
  if (c.tag === "input" && /radio|checkbox/.test(c.type)) {
    // Styled choices hide the real input under its label: click the label like a person would.
    const label = await loc.evaluateHandle((el) => el.labels?.[0] ?? el.closest("label") ?? el);
    const was = await loc.isChecked();
    await label.asElement().click({ timeout: 4000 });
    await page.waitForTimeout(300);
    const now = await loc.isChecked();
    return { kind: c.type, ok: c.type === "radio" ? now : now !== was, note: c.type === "radio" ? (was ? "already chosen" : "chosen") : `${was} → ${now}` };
  }
  if (/upload|choose a file|attach|add a file/i.test(c.name) && c.tag === "button") {
    const chooser = page.waitForEvent("filechooser", { timeout: 3000 }).then(() => true).catch(() => false);
    await loc.click({ timeout: 4000 });
    if (await chooser) return { kind: "file picker", ok: true, note: "opened the file picker" };
    return null;
  }
  await loc.click({ timeout: 4000 });
  return null;
}

const results = [];
let failures = 0;
const DIALOG = "dialog[open]";

const bare = (n) => n.replace(/\d+/g, "#");
function find(now, c) {
  return now.find((x) => x.i === c.i && bare(x.name) === bare(c.name)) || now.find((x) => bare(x.name) === bare(c.name) && x.tag === c.tag && x.type === c.type);
}

// Opens the page, clicks the pop-up trigger(s) in `via`, then tries `c` (inside the top pop-up if `scope`).
async function tryOne(p, via, c, scope) {
  const page = await ctx.newPage();
  const errs = [], reqs = [];
  page.on("console", (m) => m.type() === "error" && !/blockedbyclient|ERR_BLOCKED|Failed to fetch|Couldn't reach|status of 409/i.test(m.text()) && errs.push(m.text().slice(0, 160)));
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
  page.on("request", (r) => r.method() !== "GET" && reqs.push(`${r.method()} ${r.url().replace(BASE, "")}`));
  page.on("response", (r) => r.status() >= 500 && errs.push(`${r.status()} ${r.url().replace(BASE, "")}`));
  page.on("dialog", (d) => d.dismiss());
  let rec = { page: p, size, in: via.map((v) => v.name).join(" › ") || undefined, ...c };
  let popup = null;
  const t0 = Date.now();
  try {
    await page.goto(BASE + p, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    for (const v of via) {
      const t = find(await controls(page, v.scope), v);
      if (!t) throw new Error(`couldn't reopen ${v.name}`);
      await page.locator(v.scope ? `${v.scope} >> nth=-1` : "body").locator(LIST).nth(t.i).click({ timeout: 4000 });
      await page.waitForTimeout(700);
    }
    reqs.length = 0;
    const same = find(await controls(page, scope), c);
    if (!same) rec = { ...rec, kind: "gone", ok: true, note: "not there after reload (changes with live data)" };
    else if (same.disabled) rec = { ...rec, kind: "disabled", ok: true };
    else {
      const before = await snapshot(page);
      const direct = await act(page, same, scope);
      if (direct) rec = { ...rec, ...direct };
      else {
        await page.waitForTimeout(900);
        const after = await snapshot(page).catch(() => null);
        const what = [];
        if (!after) what.push("left the page");
        else {
          if (after.url !== before.url) what.push(`went to ${after.url.replace(BASE, "")}`);
          if (after.dialogs !== before.dialogs) what.push(after.dialogs > before.dialogs ? "opened a pop-up" : "closed a pop-up");
          if (after.expanded !== before.expanded) what.push("opened/closed or picked something");
          if (after.text !== before.text) what.push("page changed");
        }
        if (reqs.length) what.push(reqs.slice(0, 2).join(", "));
        rec = { ...rec, kind: "click", ok: what.length > 0, note: what.join("; ") };
        if (after && after.dialogs > before.dialogs && via.length < 2) popup = (await controls(page, DIALOG)).filter((x) => x.name);
      }
    }
  } catch (e) {
    rec = { ...rec, kind: "error", ok: false, note: String(e.message).split("\n")[0].slice(0, 160) };
  }
  rec.ms = Date.now() - t0;
  if (errs.length) { rec.ok = false; rec.note = `${rec.note ?? ""} · errors: ${errs.join(" | ")}`; }
  if (!rec.ok) failures++;
  results.push(rec);
  console.log(`${"  ".repeat(via.length)}${rec.ok ? "✓" : "✗"} ${c.tag}${c.type ? `[${c.type}]` : ""} "${c.name}" ${rec.kind}${rec.note ? ` — ${rec.note}` : ""} (${rec.ms}ms)`);
  await page.close();
  // Keep the dev copy usable for the next control.
  if (reqs.some((r) => r.includes("/api/pause-all"))) await fetch(BASE + "/api/pause-all", { method: "POST", body: JSON.stringify({ paused: false }) });
  return popup;
}

const seenPopups = new Set();
for (const p of paths) {
  const page = await ctx.newPage();
  await page.goto(BASE + p, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const list = await controls(page);
  await page.close();
  console.log(`\n${p}: ${list.length} controls`);
  for (const c of list) {
    const popup = await tryOne(p, [], c);
    // Each kind of pop-up once (the same "New task" panel opens from several buttons and pages).
    const key = popup?.map((x) => x.name).join("|");
    if (!popup || SKIP_NAMES.test(c.name) || seenPopups.has(key)) continue;
    seenPopups.add(key);
    for (const inner of popup) await tryOne(p, [{ ...c, scope: undefined }], inner, DIALOG);
  }
}
await b.close();
fs.writeFileSync(out, JSON.stringify(results, null, 1));
console.log(failures ? `\n${failures} control(s) need a look` : "\nEvery control did something");
