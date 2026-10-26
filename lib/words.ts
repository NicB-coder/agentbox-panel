// Plain-English helpers shared by the server and the browser.
import type { Agent, AgentInput, Allowed, NotifyOn, ScheduleKind, WorkMode } from "./types";

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function clock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function clockOf(ms: number): string {
  const d = new Date(ms);
  return clock(`${d.getHours()}:${d.getMinutes()}`);
}

function partOfDay(hhmm: string) {
  const h = Number(hhmm.split(":")[0]);
  if (h < 5 || h >= 21) return "night";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

export function scheduleWords(kind: ScheduleKind, days: number[], time: string): string {
  switch (kind) {
    case "manual":
      return "Only when you ask";
    case "hourly":
      return "Every hour, on the hour";
    case "daily":
      return `Every ${partOfDay(time)} at ${clock(time)}`;
    case "days": {
      const sorted = [...days].sort();
      if (!sorted.length) return "No days picked yet";
      const isWeekdays = sorted.join() === "1,2,3,4,5";
      const isWeekend = sorted.join() === "0,6";
      const which = isWeekdays ? "Weekdays" : isWeekend ? "Weekends" : sorted.map((d) => DAY_SHORT[d]).join(", ");
      return `${which} at ${clock(time)}`;
    }
  }
}

// Next time a schedule fires after `from` (local time). Null for "only when I ask".
export function nextRunAfter(kind: ScheduleKind, days: number[], time: string, from = Date.now()): number | null {
  if (kind === "manual") return null;
  const start = new Date(from);
  if (kind === "hourly") {
    const d = new Date(start);
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return d.getTime();
  }
  const [h, m] = time.split(":").map(Number);
  for (let i = 0; i < 8; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    d.setHours(h, m, 0, 0);
    if (d.getTime() <= from) continue;
    if (kind === "days" && !days.includes(d.getDay())) continue;
    return d.getTime();
  }
  return null;
}

export function inWords(ms: number, now = Date.now()): string {
  const diff = ms - now;
  const mins = Math.round(Math.abs(diff) / 60000);
  let s: string;
  if (mins < 1) s = "less than a minute";
  else if (mins < 60) s = `${mins} min`;
  else if (mins < 60 * 36) {
    const h = Math.round(mins / 60);
    s = `${h} hour${h === 1 ? "" : "s"}`;
  } else if (mins < 60 * 24 * 60) {
    const d = Math.round(mins / 60 / 24);
    s = `${d} day${d === 1 ? "" : "s"}`;
  } else if (mins < 60 * 24 * 365) {
    const m = Math.round(mins / 60 / 24 / 30);
    s = `${m} month${m === 1 ? "" : "s"}`;
  } else {
    const y = Math.round(mins / 60 / 24 / 365);
    s = `${y} year${y === 1 ? "" : "s"}`;
  }
  return diff >= 0 ? `in ${s}` : `${s} ago`;
}

export function ago(ms: number, now = Date.now()): string {
  if (now - ms < 60000) return "just now";
  return inWords(ms, now);
}

export function duration(ms: number): string {
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "under a minute";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const ALLOWED_WORDS: Record<Allowed, { label: string; hint: string }> = {
  look: { label: "Look only", hint: "Reads and reports. Never changes anything." },
  suggest: { label: "Suggest changes", hint: "Makes changes on a copy and opens a pull request for you." },
  make: { label: "Make changes", hint: "Can save and send its work to its own branch. Never to main." },
};

export const MODE_WORDS: Record<WorkMode, { label: string; hint: string }> = {
  auto: { label: "Auto", hint: "Works on its own. A safety checker approves each step." },
  plan: { label: "Check with me first", hint: "Writes a short plan, then waits for your OK." },
  ask: { label: "Ask me each step", hint: "Pauses before every command or change." },
  look: { label: "Look only", hint: "Never changes anything, just reports." },
};

export const NOTIFY_WORDS: Record<NotifyOn | "never", string> = {
  finished: "Finished",
  needs_ok: "Needs my OK",
  problems: "Something goes wrong",
  never: "Never",
};

export const SCHEDULE_WORDS: Record<ScheduleKind, string> = {
  manual: "Only when I ask",
  hourly: "Every hour",
  daily: "Every day",
  days: "Certain days",
};

// "Every night at 2:00 AM, Site Checker will look at portfolio without changing anything and tell you only if something's wrong."
export function agentSentence(a: Pick<AgentInput, "name" | "project" | "scheduleKind" | "scheduleDays" | "scheduleTime" | "allowed" | "mode" | "notify" | "enabled"> & { job?: { careful?: boolean; kind?: string } }): string {
  const name = a.name.trim() || "This agent";
  const project = a.project || (a.job?.kind === "research" ? "the web" : "your project");
  if (!a.enabled) return `${name} is switched off, so it won't run until you turn it back on.`;

  let when: string;
  if (a.scheduleKind === "manual") when = "When you start it";
  else if (a.scheduleKind === "hourly") when = "Every hour";
  else if (a.scheduleKind === "daily") when = `Every ${partOfDay(a.scheduleTime)} at ${clock(a.scheduleTime)}`;
  else {
    const w = scheduleWords("days", a.scheduleDays, a.scheduleTime);
    when = a.scheduleDays.length ? `On ${w.replace(/^Weekdays/, "weekdays").replace(/^Weekends/, "weekends")}` : "Once you pick some days";
  }

  const lookOnly = a.allowed === "look" || a.mode === "look";
  const research = a.job?.kind === "research";
  let verb: string;
  if (research) verb = `research ${a.project ? `for ${a.project}` : "the question"} and write you a report`;
  else if (lookOnly) verb = `look at ${project} without changing anything`;
  else if (a.mode === "plan") verb = `work on ${project} once you OK its plan`;
  else if (a.mode === "ask") verb = `work on ${project}, checking with you before each step`;
  else verb = `work on ${project} on its own and send you a pull request`;
  const careful = a.job?.careful === false ? "" : research ? ", checked against its sources," : lookOnly ? "" : ", reviewed and fixed before you see it,";

  const n = new Set(a.notify);
  let tell: string;
  if (n.size === 0) tell = "won't message you";
  else if (n.has("finished") && n.has("needs_ok")) tell = "tell you when it's done or needs your OK";
  else if (n.has("finished")) tell = n.has("problems") ? "tell you when it's done or if something goes wrong" : "tell you when it's done";
  else if (n.has("needs_ok")) tell = n.has("problems") ? "tell you when it needs your OK or something goes wrong" : "tell you when it needs your OK";
  else tell = "tell you only if something's wrong";

  return `${when}, ${name} will ${verb}${careful} and ${tell}.`;
}

export function agentAsInput(a: Agent): AgentInput {
  const { id: _i, slug: _s, kind: _k, nextRunAt: _n, createdAt: _c, paused: _p, ...rest } = a;
  return rest;
}

// Agents write a little markdown. In the main UI we show plain words.
export function plainText(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|\s)\*([^*\n]+)\*/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1 ($2)");
}

export function times(n: number): string {
  return n === 1 ? "once" : n === 2 ? "twice" : `${n} times`;
}

// "today at 6:00 PM", "tomorrow at 2:00 AM", "Friday at 9:00 AM".
export function dayAt(ms: number, now = Date.now()): string {
  const d = new Date(ms);
  const today = new Date(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(today.getDate() + 1);
  const day =
    d.toDateString() === today.toDateString()
      ? "today"
      : d.toDateString() === tomorrow.toDateString()
        ? "tomorrow"
        : d.getTime() - now < 6 * 86400_000
          ? d.toLocaleDateString("en-US", { weekday: "long" })
          : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${day} at ${clockOf(ms)}`;
}

// The reviewer's verdict. If it forgot the VERDICT line, its words decide: a review that says it isn't
// ready must never show as "Nothing to fix".
export function verdictOf(text: string): "passed" | "needs work" {
  const said = text.match(/VERDICT:\s*(passed|needs work)/gi)?.at(-1);
  if (said) return /needs work/i.test(said) ? "needs work" : "passed";
  return /\b(not ready|isn't ready|is not ready|needs work|needs to be fixed|must be fixed|must fix|changes needed|should be fixed|is missing|are missing|doesn't work|does not work|broken)\b/i.test(text) ? "needs work" : "passed";
}

// Shorten at a word, with "…" when something was cut ("…coming faster and" → "…coming faster…").
export function cutWords(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.\-–—]+$/, "").replace(/\s+(and|or|the|a|an|to|of|with|that|in|on|for)$/i, "")}…`;
}

// Nic pressed Stop. (Older runs say "You stopped it.", which means the same.)
export const USER_STOPPED = "Stopped with the Stop button.";
export const userStop = (reason: string | null | undefined) => reason === USER_STOPPED || reason === "You stopped it.";

// The plan as Nic reads it: no markdown marks, no notes about plan files or plan mode.
export function planText(p: string): string {
  return plainText(p)
    .split("\n")
    .filter((l) => !/plan mode|plan (file|is saved)|\.claude\/plans|ExitPlanMode|submit (it|the plan) for approval/i.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
