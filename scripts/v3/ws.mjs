import { chromium } from "playwright";
const b = await chromium.launch(); const p = await b.newPage();
p.on("websocket", (ws) => ws.on("framereceived", (f) => { const t = String(f.payload); if (!t.includes('"ping"') && !t.includes("turbopack-connected")) console.log("WS", t.slice(0, 400)); }));
await p.goto("http://127.0.0.1:3100" + process.argv[2], { waitUntil: "load" }); await p.waitForTimeout(3000); await b.close();
