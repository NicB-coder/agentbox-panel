import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { addRunUsageless } from "./draftUsage";
import { ingestRateLimitEvent } from "./usage";

// One short headless Claude call with no tools at all (it can only read what it's given and answer),
// answering with JSON that fits a schema. Used for drafting steps and by the prompt coach.

const PATH = [path.join(os.homedir(), ".local", "bin"), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"].join(":");

export const OUT_OF_USAGE = "You're out of Claude usage right now. Try again after it resets.";

export async function claudeJson(opts: { prompt: string; system: string; schema: object; failMessage: string; timeoutMs?: number }): Promise<Record<string, unknown>> {
  const env: NodeJS.ProcessEnv = { ...process.env, PATH };
  for (const k of Object.keys(env)) if (k === "CLAUDECODE" || k.startsWith("CLAUDE_CODE_") || k === "ANTHROPIC_API_KEY") delete env[k];
  const args = [
    "-p", opts.prompt,
    "--output-format", "stream-json", "--verbose",
    "--model", "sonnet",
    "--tools", "",
    "--permission-mode", "dontAsk",
    "--no-session-persistence",
    "--append-system-prompt", opts.system,
    "--json-schema", JSON.stringify(opts.schema),
  ];
  const stdout = await new Promise<string>((resolve, reject) => {
    execFile("claude", args, { cwd: os.tmpdir(), env, timeout: opts.timeoutMs ?? 180_000, maxBuffer: 20 * 1024 * 1024 }, (e, out, err) => {
      if (e && !out) reject(new Error(/usage limit|hit your limit/i.test(String(err) + String(out)) ? OUT_OF_USAGE : opts.failMessage));
      else resolve(String(out));
    });
  });
  let result: Record<string, unknown> | null = null;
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    let ev: Record<string, unknown>;
    try {
      ev = JSON.parse(line);
    } catch {
      continue;
    }
    if (ev.type === "rate_limit_event") ingestRateLimitEvent((ev.rate_limit_info as Record<string, unknown>) ?? {});
    if (ev.type !== "result") continue;
    addRunUsageless(Number(ev.total_cost_usd ?? 0));
    if (ev.is_error) throw new Error(/limit/i.test(String(ev.result)) ? OUT_OF_USAGE : opts.failMessage);
    result = (ev.structured_output as Record<string, unknown>) ?? null;
    if (!result && typeof ev.result === "string") {
      const m = ev.result.match(/\{[\s\S]*\}/);
      try {
        if (m) result = JSON.parse(m[0]);
      } catch {
        result = null;
      }
    }
  }
  if (!result) throw new Error(opts.failMessage);
  return result;
}
