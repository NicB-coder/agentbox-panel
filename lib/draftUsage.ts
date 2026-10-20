import { getSetting, setSetting } from "./db";

// Drafting a workflow isn't an agent run, but it still uses a little Claude usage; keep a daily total.
export function addRunUsageless(costUsd: number) {
  const today = new Date().toDateString();
  const cur = getSetting<{ day: string; cost: number; count: number }>("draftUsage", { day: today, cost: 0, count: 0 });
  const next = cur.day === today ? { day: today, cost: cur.cost + costUsd, count: cur.count + 1 } : { day: today, cost: costUsd, count: 1 };
  setSetting("draftUsage", next);
}

export function draftUsageToday(): { cost: number; count: number } {
  const cur = getSetting<{ day: string; cost: number; count: number }>("draftUsage", { day: "", cost: 0, count: 0 });
  return cur.day === new Date().toDateString() ? cur : { cost: 0, count: 0 };
}
