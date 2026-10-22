#!/usr/bin/env node
// Runs one Claude Code session for the panel, supervised by its own launchd job, so it keeps going
// while the panel restarts or updates. The panel reattaches by reading the files this writes.
//
//   node proc-runner.mjs <spec.json>
//
// spec: { cmd, args, cwd, env, out, err, exit, pidFile }
// Writes Claude's output to `out`/`err`, its pids to `pidFile`, and {code, signal, at} to `exit` when it ends.
import { spawn } from "node:child_process";
import fs from "node:fs";

const spec = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const out = fs.openSync(spec.out, "a");
const err = fs.openSync(spec.err, "a");

if (fs.existsSync(spec.exit)) process.exit(0); // already finished (launchd started us again): nothing to do

const child = spawn(spec.cmd, spec.args, {
  cwd: spec.cwd,
  env: spec.env,
  stdio: ["ignore", out, err],
  detached: true, // its own process group, so a stop takes down everything it started
});

fs.writeFileSync(spec.pidFile, JSON.stringify({ runner: process.pid, child: child.pid, at: Date.now() }));

let stopping = false;
function stop(sig) {
  if (stopping || !child.pid) return;
  stopping = true;
  try {
    process.kill(-child.pid, sig);
  } catch {
    try {
      child.kill(sig);
    } catch {
      /* gone */
    }
  }
  setTimeout(() => {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      /* gone */
    }
  }, 8000).unref();
}
process.on("SIGTERM", () => stop("SIGTERM"));
process.on("SIGINT", () => stop("SIGTERM"));
process.on("SIGHUP", () => {}); // the panel going away is not a reason to stop

child.on("error", (e) => {
  fs.appendFileSync(spec.err, `\nCouldn't start ${spec.cmd}: ${e.message}\n`);
  fs.writeFileSync(spec.exit, JSON.stringify({ code: 127, signal: null, at: Date.now(), error: e.message }));
  process.exit(0);
});

child.on("exit", (code, signal) => {
  fs.writeFileSync(spec.exit, JSON.stringify({ code, signal, at: Date.now(), stopped: stopping }));
  // Whatever it started in its group goes too.
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    /* gone */
  }
  process.exit(0);
});
