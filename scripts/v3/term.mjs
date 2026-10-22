// The Terminal page: type a command, see its output, at laptop and phone width.
import { BASE, browser, done, newPage, ok, pageCheck, shot } from "./lib.mjs";
const b = await browser();
for (const size of ["laptop", "phone"]) {
  const page = await newPage(b, size);
  await page.goto(`${BASE}/terminal`, { waitUntil: "load" });
  await page.waitForSelector(".xterm-rows");
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/Type a command/).fill(`echo agentbox-$((40+2))-${size}`);
  await page.getByRole("button", { name: "Run" }).click();
  await page.waitForTimeout(1500);
  const text = await page.locator(".xterm-rows").innerText();
  ok(text.includes(`agentbox-42-${size}`), `${size}: the command ran in a real shell`);
  await page.locator(".xterm-helper-textarea").focus();
  await page.keyboard.type("whoami\n");
  await page.waitForTimeout(1200);
  ok((await page.locator(".xterm-rows").innerText()).includes("agent"), `${size}: typing straight into the terminal works`);
  await pageCheck(page, `${size} terminal`);
  await shot(page, `m3-${size}-terminal`);
  await page.close();
}
await b.close();
done();
