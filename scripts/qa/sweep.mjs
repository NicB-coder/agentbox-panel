// Full check-over, part 1: every page at 1366, 768 and 390px wide.
// Checks: console errors, failed network requests, sideways scrolling, tap targets, load time,
// and that polling keeps the page responsive. Also lists every control it finds (for QA-CHECKLIST.md).
// Usage: BASE_URL=http://127.0.0.1:3253 node scripts/qa/sweep.mjs [out.json] [--only] [/extra/path ...]
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3100";
const out = process.argv[2] || "/tmp/agentbox-sweep.json";
const WIDTHS = { laptop: [1366, 900], tablet: [768, 1024], phone: [390, 844] };
const only = process.argv[3] === "--only";
const extra = process.argv.slice(only ? 4 : 3);

async function pagesToCheck() {
  const j = async (p) => (await fetch(BASE + p)).json().catch(() => null);
  const state = await j("/api/state");
  const wfs = await j("/api/workflows/state");
  const paths = ["/", "/inbox", "/workflows", "/workflows/new", "/projects", "/settings", "/help", "/machine", "/changes", "/connectors", "/terminal", "/agents/new"];
  for (const { agent: a } of state?.views ?? []) paths.push(`/agents/${a.id}`, ...(a.slug !== "heartbeat" ? [`/agents/${a.id}/edit`] : []));
  for (const w of wfs?.tiles ?? []) paths.push(`/workflows/${w.id}`, `/workflows/${w.id}?run=0`);
  paths.push("/changes?pr=" + encodeURIComponent("https://github.com/NicB-coder/agentbox-panel/pull/12"));
  paths.push("/agents/99999", "/workflows/99999", "/no-such-page");
  return [...new Set([...paths, ...extra])];
}

const paths = only ? extra : await pagesToCheck();
const b = await chromium.launch();
const results = [];
let bad = 0;
for (const [size, [w, h]] of Object.entries(WIDTHS)) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.request.post(`${BASE}/api/settings`, { data: { tourDone: true } }).catch(() => {});
  const page = await ctx.newPage();
  let errors = [], failed = [];
  page.on("console", (m) => m.type() === "error" && !(/404/.test(m.text()) && /no-such-page|99999/.test(m.location()?.url || "")) && errors.push(m.text().slice(0, 200)));
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  page.on("response", (r) => { if (r.status() >= 400 && !/\/(99999|no-such-page)/.test(r.url())) failed.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASE, "")}`); });
  page.on("requestfailed", (r) => { const f = r.failure()?.errorText || ""; if (!/ERR_ABORTED|cancel/i.test(f)) failed.push(`failed ${r.url().replace(BASE, "")} ${f}`); });
  for (const p of paths) {
    errors = []; failed = [];
    const t0 = Date.now();
    const resp = await page.goto(BASE + p, { waitUntil: "domcontentloaded" });
    await page.locator("main, h1").first().waitFor({ timeout: 10000 }).catch(() => {});
    const load = Date.now() - t0;
    // Let it poll for a while, and check the page still answers quickly.
    await page.waitForTimeout(4000);
    const t1 = Date.now();
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
    const frame = Date.now() - t1;
    const r = await page.evaluate(() => {
      const overflow = document.documentElement.scrollWidth > window.innerWidth + 1;
      const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden"; };
      const small = [...document.querySelectorAll("a, button, select, input:not(.sr-only), textarea, label:has(input.sr-only)")]
        .filter((el) => {
          if (!vis(el)) return false;
          const r = el.getBoundingClientRect();
          if (el.closest("label") && el.tagName === "INPUT") return false;
          if (el.matches(".sr-only, .sr-only *")) return false;
          if (el.closest("pre, .prose-report, .xterm, .prose")) return false;
          return r.height < 44 && r.width < 44 ? true : r.height < 44 && el.tagName !== "A" ? true : r.height < 24;
        })
        .map((el) => `${el.tagName} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}" ${Math.round(el.getBoundingClientRect().height)}px`);
      const name = (el) => (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || el.getAttribute("name") || el.id || "").replace(/\s+/g, " ").trim().slice(0, 60);
      const controls = [...document.querySelectorAll("a[href], button, input, select, textarea, [role=switch], [role=tab], summary")]
        .filter(vis).filter((el) => !el.closest("[data-helper-root], .helper-root"))
        .map((el) => ({ tag: el.tagName.toLowerCase(), type: el.getAttribute("type") || el.getAttribute("role") || "", name: name(el), href: el.getAttribute("href") || "" }));
      const offscreen = [...document.querySelectorAll("button, a[href], input, select, textarea")].filter(vis).filter((el) => {
        const r = el.getBoundingClientRect();
        for (let a = el.parentElement; a; a = a.parentElement) if (/auto|scroll/.test(getComputedStyle(a).overflowX)) return false;
        return r.right > window.innerWidth + 1 || r.left < -1;
      }).map((el) => name(el)).slice(0, 5);
      return { overflow, small, controls, offscreen, title: document.querySelector("h1")?.textContent?.trim() || "" };
    });
    const status = resp?.status() ?? 0;
    const problems = [];
    if (errors.length) problems.push(`console: ${errors.slice(0, 3).join(" | ")}`);
    if (failed.length) problems.push(`requests: ${[...new Set(failed)].slice(0, 5).join(" | ")}`);
    if (r.overflow) problems.push("scrolls sideways");
    if (r.offscreen.length) problems.push(`off screen: ${r.offscreen.join(", ")}`);
    if (r.small.length) problems.push(`small: ${r.small.slice(0, 5).join("; ")}`);
    if (load > 1000) problems.push(`slow: ${load}ms`);
    if (frame > 200) problems.push(`froze: ${frame}ms`);
    if (problems.length) bad++;
    console.log(`${problems.length ? "✗" : "✓"} ${size} ${p} (${status}, ${load}ms, ${r.controls.length} controls)${problems.length ? "\n    " + problems.join("\n    ") : ""}`);
    results.push({ size, path: p, status, load, frame, title: r.title, problems, controls: r.controls });
    await page.screenshot({ path: `${out.replace(/\.json$/, "")}-${size}${p.replace(/[^a-z0-9]+/gi, "-").slice(0, 50)}.png`, fullPage: true }).catch(() => {});
  }
  await ctx.close();
}
await b.close();
fs.writeFileSync(out, JSON.stringify(results, null, 1));
console.log(bad ? `\n${bad} page view(s) with problems` : "\nAll pages clean");
process.exit(bad ? 1 : 0);
