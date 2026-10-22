import type { AgentInput, Allowed, Model, NotifyOn, ScheduleKind, WorkMode } from "./types";
import { jobOf } from "./job";

const SCHEDULES: ScheduleKind[] = ["manual", "hourly", "daily", "days"];
const ALLOWED: Allowed[] = ["look", "suggest", "make"];
const MODES: WorkMode[] = ["auto", "plan", "ask", "look"];
const MODELS: Model[] = ["sonnet", "opus"];
const NOTIFY: NotifyOn[] = ["finished", "needs_ok", "problems"];

// Turns whatever the editor sent into a clean agent, or a plain-English reason it can't be saved.
export function parseAgentInput(body: unknown, projects: string[]): { ok: true; agent: AgentInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = String(b.name ?? "").trim();
  if (!name) return { ok: false, error: "Give your agent a name." };
  if (name.length > 40) return { ok: false, error: "Keep the name under 40 characters." };
  const prompt = String(b.prompt ?? "").trim();
  if (prompt.length < 10) return { ok: false, error: "Tell it what to do in a sentence or two." };
  const job = b.job ? jobOf(b.job) : undefined;
  const project = String(b.project ?? "");
  if (!projects.includes(project) && !(project === "" && job?.kind === "research")) return { ok: false, error: "Pick a project from the list." };
  const scheduleKind = b.scheduleKind as ScheduleKind;
  if (!SCHEDULES.includes(scheduleKind)) return { ok: false, error: "Pick when it should run." };
  const scheduleDays = Array.isArray(b.scheduleDays) ? [...new Set((b.scheduleDays as unknown[]).map(Number).filter((d) => d >= 0 && d <= 6))] : [];
  if (scheduleKind === "days" && !scheduleDays.length) return { ok: false, error: "Pick at least one day." };
  const scheduleTime = String(b.scheduleTime ?? "02:00");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(scheduleTime)) return { ok: false, error: "Pick a time." };
  const allowed = b.allowed as Allowed;
  if (!ALLOWED.includes(allowed)) return { ok: false, error: "Pick what it's allowed to do." };
  const mode = b.mode as WorkMode;
  if (!MODES.includes(mode)) return { ok: false, error: "Pick how it should work with you." };
  const model = b.model as Model;
  if (!MODELS.includes(model)) return { ok: false, error: "Pick Fast or Smartest." };
  const maxMinutes = Math.round(Number(b.maxMinutes));
  if (!(maxMinutes >= 5 && maxMinutes <= 240)) return { ok: false, error: "The time limit must be between 5 minutes and 4 hours." };
  const notify = Array.isArray(b.notify) ? (b.notify as NotifyOn[]).filter((n) => NOTIFY.includes(n)) : [];
  const color = String(b.color ?? "");
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) return { ok: false, error: "Pick a color." };
  const icon = String(b.icon ?? "");
  if (!/^[a-z]{2,12}$/.test(icon)) return { ok: false, error: "Pick an icon." };
  return {
    ok: true,
    agent: { name, prompt, project, scheduleKind, scheduleDays, scheduleTime, allowed, mode, model, maxMinutes, notify, color, icon, enabled: b.enabled !== false, ...(job ? { job } : {}) },
  };
}
