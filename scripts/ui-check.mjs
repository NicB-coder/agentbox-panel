// Opens pages in a real browser at laptop and phone width, saves screenshots,
// and fails on console errors, horizontal scrolling or tiny tap targets.
// Usage: node scripts/ui-check.mjs [outDir] [path ...]
import { chromium } from "playwright";
import fs from "node:fs";

const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const out = process.argv[2] || "screenshots";
const paths = process.argv.slice(3).length ? process.argv.slice(3) : ["/", "/agents/1", "/agents/new"];
const sizes = { laptop: { width: 1366, height: 900 }, phone: { width: 390, height: 844 } };
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
let problems = 0;
for (const [label, viewport] of Object.entries(sizes)) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  for (const p of paths) {
    await page.goto(base + p, { waitUntil: "networkidle" });
    const name = `${label}${p.replace(/[^a-z0-9]+/gi, "-").replace(/-$/, "") || "-home"}.png`;
    await page.screenshot({ path: `${out}/${name}`, fullPage: true });
    const report = await page.evaluate(() => {
      const overflow = document.documentElement.scrollWidth > window.innerWidth + 1;
      const small = [...document.querySelectorAll("a, button, select, input:not(.sr-only), textarea, label:has(input.sr-only)")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) return false;
          if (el.closest("label") && el.tagName === "INPUT") return false;
          if (el.matches(".sr-only, .sr-only *")) return false;
          return r.height < 44 && r.width < 44 ? true : r.height < 44 && el.tagName !== "A" ? true : r.height < 24;
        })
        .map((el) => `${el.tagName} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}" ${Math.round(el.getBoundingClientRect().height)}px`);
      return { overflow, small };
    });
    const bad = errors.length || report.overflow || report.small.length;
    if (bad) problems++;
    console.log(`${bad ? "✗" : "✓"} ${label} ${p}${report.overflow ? " · scrolls sideways" : ""}`);
    for (const e of errors) console.log("   console:", e.slice(0, 300));
    for (const s of report.small) console.log("   small target:", s);
    errors.length = 0;
  }
  await page.close();
}
await browser.close();
process.exit(problems ? 1 : 0);
