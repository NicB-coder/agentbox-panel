import { chromium } from "playwright";
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
p.on("console", m => console.log(m.type(), m.text().slice(0,300)));
p.on("pageerror", e => console.log("PAGEERR", String(e).slice(0,500)));
await p.goto("http://127.0.0.1:3100" + process.argv[2], { waitUntil: "load" }); await p.waitForTimeout(1500);
await b.close();
