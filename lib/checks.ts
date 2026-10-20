import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import type { CheckKind } from "./types";

// Hard gates for the Check step. These are real tests run by the panel, not an agent's opinion.

export type CheckResult = { kind: CheckKind; result: "passed" | "failed" | "skipped"; note: string; detail: string };

const PATH = [path.join(os.homedir(), ".local", "bin"), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(":");

function env(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const e: NodeJS.ProcessEnv = { ...process.env, PATH, CI: "1", ...extra };
  for (const k of Object.keys(e)) if (k === "CLAUDECODE" || k.startsWith("CLAUDE_CODE_") || k === "ANTHROPIC_API_KEY" || k.startsWith("NEXT_") || k === "PORT") delete e[k];
  Object.assign(e, extra);
  e.AGENTBOX_NO_SCHEDULE = "1"; // if the project is this panel, its copy must never start agents
  e.AGENTBOX_DATA_DIR = path.join(os.tmpdir(), "agentbox-check-data");
  return e;
}

function run(cmd: string, args: string[], cwd: string, timeout: number): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd, timeout, env: env(), maxBuffer: 20 * 1024 * 1024 }, (e, stdout, stderr) =>
      resolve({ ok: !e, out: `${stdout}\n${stderr}`.trim().slice(-6000) }),
    );
  });
}

function readPkg(dir: string): { scripts?: Record<string, string> } | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  } catch {
    return null;
  }
}

async function installIfNeeded(dir: string): Promise<{ ok: boolean; out: string }> {
  if (fs.existsSync(path.join(dir, "node_modules"))) return { ok: true, out: "" };
  const lock = fs.existsSync(path.join(dir, "package-lock.json"));
  return run("npm", [lock ? "ci" : "install", "--no-audit", "--no-fund"], dir, 10 * 60_000);
}

export async function testsPass(dir: string): Promise<CheckResult> {
  const pkg = readPkg(dir);
  const script = pkg?.scripts?.test;
  if (!script || /no test specified/.test(script)) {
    return { kind: "tests", result: "skipped", note: "This project has no tests yet, so there was nothing to run.", detail: "" };
  }
  const inst = await installIfNeeded(dir);
  if (!inst.ok) return { kind: "tests", result: "failed", note: "Couldn't install the project's packages to run the tests.", detail: inst.out };
  const r = await run("npm", ["test"], dir, 15 * 60_000);
  return r.ok
    ? { kind: "tests", result: "passed", note: "All the tests passed.", detail: r.out }
    : { kind: "tests", result: "failed", note: "Some tests failed.", detail: r.out };
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

function waitForPort(port: number, ms: number): Promise<boolean> {
  const end = Date.now() + ms;
  return new Promise((resolve) => {
    const tryOnce = () => {
      const req = http.get({ host: "127.0.0.1", port, path: "/", timeout: 3000 }, (res) => {
        res.resume();
        resolve(true);
      });
      req.on("error", () => (Date.now() > end ? resolve(false) : setTimeout(tryOnce, 1000)));
      req.on("timeout", () => req.destroy());
    };
    tryOnce();
  });
}

// A tiny static server for plain HTML projects.
function staticServer(root: string, port: number): http.Server {
  const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
  const srv = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
    let file = path.join(root, path.normalize(url).replace(/^(\.\.[/\\])+/, ""));
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404).end("Not found");
        return;
      }
      res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" }).end(data);
    });
  });
  srv.listen(port, "127.0.0.1");
  return srv;
}

// Start the project on this Mac (or use the full address Nic gave), then open it in a real browser.
export async function pageChecks(dir: string, pagePath: string, kinds: CheckKind[]): Promise<CheckResult[]> {
  const want = kinds.filter((k) => k === "page" || k === "console");
  if (!want.length) return [];
  const fail = (note: string, detail = ""): CheckResult[] => want.map((kind) => ({ kind, result: "failed", note, detail }));

  let url: string;
  let stop = () => {};
  if (/^https?:\/\//.test(pagePath)) url = pagePath;
  else {
    const port = await freePort();
    const pkg = readPkg(dir);
    const script = pkg?.scripts?.dev ? "dev" : pkg?.scripts?.start ? "start" : null;
    if (script) {
      const inst = await installIfNeeded(dir);
      if (!inst.ok) return fail("Couldn't install the project's packages to start it.", inst.out);
      let out = "";
      const child = spawn("npm", ["run", script, "--", "--port", String(port)], { cwd: dir, env: env({ PORT: String(port) }), detached: true, stdio: ["ignore", "pipe", "pipe"] });
      child.stdout?.on("data", (c) => (out = (out + c).slice(-4000)));
      child.stderr?.on("data", (c) => (out = (out + c).slice(-4000)));
      stop = () => {
        try {
          process.kill(-child.pid!, "SIGTERM");
        } catch {
          /* gone */
        }
      };
      if (!(await waitForPort(port, 120_000))) {
        stop();
        return fail("The project didn't start on this Mac, so the page couldn't be opened.", out);
      }
    } else if (fs.existsSync(path.join(dir, pagePath.replace(/\/?$/, "/"), "index.html")) || fs.existsSync(path.join(dir, "index.html"))) {
      const srv = staticServer(dir, port);
      stop = () => srv.close();
    } else {
      return want.map((kind) => ({ kind, result: "skipped", note: "There's no web page in this project to open. Add a full web address in the step to check a live site.", detail: "" }));
    }
    url = `http://127.0.0.1:${port}${pagePath.startsWith("/") ? pagePath : `/${pagePath}`}`;
  }

  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
      const errors: string[] = [];
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(String(e)));
      let status = 0;
      let loadErr = "";
      try {
        const res = await page.goto(url, { waitUntil: "load", timeout: 60_000 });
        status = res?.status() ?? 0;
        await page.waitForTimeout(2500); // let scripts run and log
      } catch (e) {
        loadErr = (e as Error).message;
      }
      const title = await page.title().catch(() => "");
      const out: CheckResult[] = [];
      const loaded = !loadErr && status > 0 && status < 400;
      if (want.includes("page"))
        out.push(
          loaded
            ? { kind: "page", result: "passed", note: `The page loaded${title ? ` (“${title.slice(0, 60)}”)` : ""}.`, detail: url }
            : { kind: "page", result: "failed", note: loadErr ? "The page didn't load in the browser." : `The page answered with an error (${status}).`, detail: `${url}\n${loadErr}` },
        );
      if (want.includes("console"))
        out.push(
          !loaded
            ? { kind: "console", result: "failed", note: "Couldn't check for errors because the page didn't load.", detail: url }
            : errors.length
              ? { kind: "console", result: "failed", note: `The browser showed ${errors.length} error${errors.length === 1 ? "" : "s"}.`, detail: errors.slice(0, 20).join("\n") }
              : { kind: "console", result: "passed", note: "No errors in the browser console.", detail: url },
        );
      return out;
    } finally {
      await browser.close();
    }
  } catch (e) {
    return fail("Couldn't open a browser on this Mac to check the page.", String(e));
  } finally {
    stop();
  }
}

export async function runChecks(dir: string, kinds: CheckKind[], pagePath: string): Promise<CheckResult[]> {
  const out: CheckResult[] = [];
  if (kinds.includes("tests")) out.push(await testsPass(dir));
  out.push(...(await pageChecks(dir, pagePath || "/", kinds)));
  return out;
}
