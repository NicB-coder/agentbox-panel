// Every page at laptop and phone width: console errors, sideways scrolling, tap targets. Usage: node pages.mjs /path ...
import { BASE, browser, done, newPage, pageCheck, shot } from "./lib.mjs";
const paths = process.argv.slice(2);
const b = await browser();
for (const size of ["laptop", "phone"]) {
  const page = await newPage(b, size);
  for (const p of paths) {
    await page.goto(BASE + p, { waitUntil: "load" });
    await page.waitForTimeout(2500);
    await pageCheck(page, `${size} ${p}`);
    await shot(page, `pages-${size}${p.replace(/[^a-z0-9]+/gi, "-").slice(0, 60)}`);
  }
  await page.close();
}
await b.close();
done();
