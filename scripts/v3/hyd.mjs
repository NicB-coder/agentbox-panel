import { chromium } from "playwright";
const b = await chromium.launch(); const p = await b.newPage();
p.on("console", (m) => m.type() === "error" && console.log(m.text().slice(0, 3000)));
await p.goto("http://127.0.0.1:3100" + (process.argv[2] || "/"), { waitUntil: "load" }); await p.waitForTimeout(2500); await b.close();
