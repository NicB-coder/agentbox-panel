// Shared bits for the v3 browser tests (Playwright). Run against the dev copy on port 3100.
import { chromium } from "playwright";
import fs from "node:fs";

export const BASE = process.env.BASE_URL || "http://127.0.0.1:3100";
export const SIZES = { laptop: { width: 1366, height: 900 }, phone: { width: 390, height: 844 } };
export const SHOTS = process.env.SHOTS || "/tmp/agentbox-v3-shots";
fs.mkdirSync(SHOTS, { recursive: true });

let failures = 0;
export function ok(cond, what) {
  console.log(`${cond ? "✓" : "✗"} ${what}`);
  if (!cond) failures++;
  return cond;
}
export function done() {
  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}

export async function browser() {
  return chromium.launch();
}

export async function newPage(b, size) {
  const page = await b.newPage({ viewport: SIZES[size], deviceScaleFactor: 1 });
  page.errors = [];
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource.*(404|409|400)/.test(m.text()) && page.errors.push(m.text()));
  page.on("pageerror", (e) => page.errors.push(String(e)));
  // The welcome tour would cover everything on a first visit.
  await page.request.post(`${BASE}/api/settings`, { data: { tourDone: true } }).catch(() => {});
  return page;
}

// Console errors, sideways scrolling, tiny tap targets.
export async function pageCheck(page, label) {
  const r = await page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth > window.innerWidth + 1;
    const small = [...document.querySelectorAll("a, button, select, input:not(.sr-only), textarea, label:has(input.sr-only)")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return false;
        if (el.closest("label") && el.tagName === "INPUT") return false;
        if (el.matches(".sr-only, .sr-only *")) return false;
        if (el.closest("pre, .prose-report")) return false;
        return r.height < 44 && r.width < 44 ? true : r.height < 44 && el.tagName !== "A" ? true : r.height < 24;
      })
      .map((el) => `${el.tagName} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}" ${Math.round(el.getBoundingClientRect().height)}px`);
    return { overflow, small };
  });
  ok(!r.overflow, `${label}: no sideways scrolling`);
  ok(r.small.length === 0, `${label}: tap targets 44px+${r.small.length ? ` (${r.small.slice(0, 4).join("; ")})` : ""}`);
  ok(page.errors.length === 0, `${label}: no console errors${page.errors.length ? ` (${page.errors.slice(0, 2).join(" | ").slice(0, 300)})` : ""}`);
  page.errors.length = 0;
}

export async function shot(page, name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

export async function api(page, path, body, method = body ? "POST" : "GET") {
  const r = method === "GET" ? await page.request.get(BASE + path) : await page.request.fetch(BASE + path, { method, data: body ?? {} });
  return { status: r.status(), json: await r.json().catch(() => null) };
}

export async function waitFor(fn, ms = 120_000, every = 1500) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) return null;
    await new Promise((r) => setTimeout(r, every));
  }
}
