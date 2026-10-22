// v3 job settings shared by the browser and the server: Freedom, Careful/Quick, defaults and names.
import type { Allowed, Freedom, JobKind, JobSettings, WorkMode } from "./types";

export const DEFAULT_JOB: JobSettings = {
  kind: "build",
  careful: true,
  askEachStep: false,
  connectors: [],
  big: false,
  budgetPct: 40,
  holdSmall: true,
  autoInstall: false,
  saveReport: false,
  brief: null,
};

export function jobOf(raw: unknown): JobSettings {
  const j = (raw && typeof raw === "object" ? raw : {}) as Partial<JobSettings>;
  return {
    ...DEFAULT_JOB,
    ...j,
    connectors: Array.isArray(j.connectors) ? j.connectors.filter((c) => typeof c === "string") : [],
  };
}

export const FREEDOM_WORDS: Record<Freedom, { label: string; tip: string }> = {
  look: { label: "Look only", tip: "It reads and reports back. It never changes anything." },
  check: { label: "Check with me first", tip: "It writes a short plan and waits for your OK before it changes anything." },
  auto: { label: "On its own", tip: "It works by itself. A safety checker approves each step, and you always get the result as a pull request." },
};

export const FREEDOM_ORDER: Freedom[] = ["look", "check", "auto"];

// Freedom (+ "Ask me each step") → the two v1 settings the runner understands.
export function modeFor(freedom: Freedom, askEachStep: boolean): { mode: WorkMode; allowed: Allowed } {
  if (freedom === "look") return { mode: "look", allowed: "look" };
  if (askEachStep) return { mode: "ask", allowed: "suggest" };
  return { mode: freedom === "check" ? "plan" : "auto", allowed: "suggest" };
}

export function freedomOf(a: { mode: WorkMode; allowed: Allowed }): Freedom {
  if (a.mode === "look" || a.allowed === "look") return "look";
  if (a.mode === "plan") return "check";
  return "auto";
}

// Sensible time limits so routine runs rarely hit them.
export function defaultMinutes(kind: JobKind, careful: boolean, freedom: Freedom): number {
  if (kind === "research") return 60;
  if (freedom === "look") return careful ? 30 : 20;
  return careful ? 60 : 30;
}

const LEAD = /^(please\s+|can you\s+|could you\s+|i want( you)? to\s+|i'd like( you)? to\s+|let's\s+|go\s+|help me\s+)+/i;
const VERBS: Record<string, string> = {
  fix: "fixes", repair: "fixes", debug: "fixes", research: "research", investigate: "research", study: "research",
  review: "review", check: "check", test: "tests", clean: "cleanup", tidy: "cleanup", refactor: "cleanup",
};
const DROP = new Set(["a", "an", "the", "my", "our", "some", "this", "that", "me", "us", "of", "for", "to", "on", "in", "with", "and", "up", "out", "about", "it", "new", "simple", "small", "little", "quick"]);
const MAKE = new Set(["make", "build", "create", "write", "add", "design", "set", "setup", "put", "do", "start", "find", "look", "improve", "update", "change", "turn", "get", "give", "show"]);

// A short name for the job from the task: "Make an arcade website with 4 games" → "Arcade website".
export function jobName(task: string, kind: JobKind = "build"): string {
  const first = task.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s|\n/)[0] ?? "";
  const words = first.replace(LEAD, "").replace(/[^\p{L}\p{N}'\- ]/gu, " ").split(" ").filter(Boolean);
  if (!words.length) return kind === "research" ? "Research" : "New task";
  let suffix = "";
  const verb = words[0].toLowerCase();
  if (VERBS[verb]) {
    suffix = VERBS[verb];
    words.shift();
  } else if (MAKE.has(verb)) words.shift();
  // Questions: "What are the best…" → keep the subject.
  if (/^(what|how|why|which|who|where|when|is|are|does|do|can|should)$/i.test(words[0] ?? "")) {
    words.shift();
    suffix = suffix || (kind === "research" ? "research" : "");
  }
  const keep: string[] = [];
  for (const w of words) {
    if (keep.length >= 3) break;
    if (DROP.has(w.toLowerCase()) || /^(is|are|be|was|were|best|good|most)$/i.test(w)) {
      if (keep.length >= 2) break;
      continue;
    }
    if (/^(with|that|which|so|because|using|from|where|when|but|then)$/i.test(w)) break;
    keep.push(w.length > 18 ? w.slice(0, 18) : w);
  }
  if (!keep.length) keep.push(...words.slice(0, 2));
  if (suffix && keep.length > 2) keep.length = 2;
  let name = [...keep, suffix].filter(Boolean).join(" ");
  name = name.charAt(0).toUpperCase() + name.slice(1);
  if (kind === "research" && !/research/i.test(name) && name.split(" ").length < 3) name += " research";
  return name.slice(0, 40);
}

// The color a new job gets: the one used least among active jobs.
export function pickColor(used: string[], choices: string[]): string {
  const count = (c: string) => used.filter((u) => u.toLowerCase() === c.toLowerCase()).length;
  return [...choices].sort((a, b) => count(a) - count(b))[0] ?? choices[0];
}

export function iconFor(kind: JobKind, freedom: Freedom, scheduled: boolean): string {
  if (kind === "research") return "book";
  if (freedom === "look") return scheduled ? "globe" : "eye";
  return scheduled ? "moon" : "hammer";
}
