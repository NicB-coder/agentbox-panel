import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto("http://127.0.0.1:3100" + (process.argv[2] || "/"), { waitUntil: "networkidle" });
console.log(await p.evaluate(() => {
  const W = window.innerWidth;
  return [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > W + 1).slice(0, 8).map((e) => `${e.tagName}.${String(e.className).slice(0, 60)} right=${Math.round(e.getBoundingClientRect().right)} "${(e.textContent || "").trim().slice(0, 40)}"`).join("\n");
}));
await b.close();
