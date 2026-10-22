// Quick screenshot helper: node scripts/v3/snap.mjs <path> <laptop|phone> <out.png> [click text...]
import { chromium } from "playwright";
const [path, size, out, ...clicks] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: size === "phone" ? { width: 390, height: 844 } : { width: 1366, height: 900 } });
await p.goto("http://127.0.0.1:3100" + path, { waitUntil: "networkidle" });
for (const c of clicks) {
  if (c.startsWith("wait:")) await p.waitForTimeout(Number(c.slice(5)));
  else if (c.startsWith("full")) continue;
  else await p.getByText(c.replace(/^~/, ""), { exact: !c.startsWith("~") ? true : false }).locator("visible=true").first().click();
  await p.waitForTimeout(300);
}
await p.screenshot({ path: out, fullPage: clicks.includes("full") });
await b.close();
