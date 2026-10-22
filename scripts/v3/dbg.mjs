import { chromium } from "playwright";
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
p.on("console", (m) => console.log("console", m.type(), m.text().slice(0, 500)));
p.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 800)));
p.on("requestfailed", (r) => console.log("FAILED", r.url().slice(0, 150), r.failure()?.errorText));
await p.goto("http://127.0.0.1:3100" + process.argv[2], { waitUntil: "load" }); await p.waitForTimeout(6000);
console.log((await p.locator("main").innerText()).slice(0, 300));
await b.close();
