// The Helper test set: real questions Nic could ask on each page, with what a good answer must
// (and must never) contain. `facts` is read fresh from the panel being tested (see run.mjs), so the
// expected numbers and names always come from the real data, never from this file.
//
// Each question: { id, ctx, q, max?, must?, mustNot?, actions?, noActions?, cards?, check? }
//   ctx      where Nic is (same shape the bubble sends): path, plus panels/editing/fill for open forms
//   max      most words allowed (default 100)
//   must     patterns that must ALL appear (an array inside means "any of these")
//   mustNot  patterns that must not appear
//   actions  button kinds that must be offered (an array inside means "any of these")
//   noActions button kinds that must NOT be offered
//   check    (reply, facts) => problem string or "" for anything more specific

const taskPanel = (goal) => ({
  path: "/",
  panels: [`Start a task panel · What kind: Build something · goal box says: "${goal}" · Project: agentbox-panel · When: Now · Freedom: On its own · Careful · Model: Fast · Time limit: 60 min · Brief: none`],
  fill: "the goal box of the Start a task panel",
});

const nothingRunning = /nothing|no (agents?|workflows?|runs?)|none of|isn't anything|aren't any|not running|all (quiet|idle)|idle/i;

export const QUESTIONS = (f) => [
  // ---------- home ----------
  { id: "running", ctx: { path: "/" }, q: "What's running?", must: [f.running.length ? new RegExp(f.running.map(esc).join("|")) : nothingRunning] },
  { id: "needs-me", ctx: { path: "/" }, q: "What needs me right now?", must: [f.inbox ? new RegExp(String(f.inbox)) : /nothing|no(thing)? .{0,25}(needs|waiting)|all clear|empty|caught up/i] },
  {
    id: "usage-left", ctx: { path: "/" }, q: "How much usage is left?",
    must: [[new RegExp(`\\b${f.session}%`), new RegExp(`\\b${100 - f.session}%`)]],
  },
  { id: "usage-reset", ctx: { path: "/" }, q: "When does my usage reset?", must: [f.resetClock ? new RegExp(esc(f.resetClock).replace(":00", "(:00)?").replace(" ", "\\s?"), "i") : /./] },
  { id: "heartbeat", ctx: { path: "/" }, q: "Is the heartbeat checking in on time today?", must: [new RegExp(esc(f.heartbeat))] },
  { id: "count-workflows", ctx: { path: "/" }, q: "How many workflows do I have?", must: [new RegExp(`\\b(${f.workflows.length}|${words(f.workflows.length)})\\b`, "i")] },
  { id: "workflows-on", ctx: { path: "/" }, q: "Which of my workflows are switched on?", must: f.workflows.filter((w) => w.enabled).map((w) => new RegExp(esc(w.name), "i")) },
  { id: "last-wf-run", ctx: { path: "/" }, q: "How did my last workflow run go?", must: [new RegExp(f.lastWfRun.status === "stopped" ? "stop" : f.lastWfRun.status, "i")] },
  // A trick question when the Reviewer's last run actually finished: it must say so, not make up a reason.
  {
    id: "reviewer-stop", ctx: { path: "/" }, q: "Why did the Reviewer stop last time?",
    must: [f.reviewerLast.status === "stopped" ? new RegExp(esc((f.reviewerLast.stop_reason ?? "").split(/[.(]/)[0].trim()).slice(0, 30) || "stop", "i") : /didn't stop|did not stop|finished|done|wasn't stopped|completed/i],
  },
  { id: "projects", ctx: { path: "/projects" }, q: "What projects do I have?", must: f.projects.slice(0, 6).map((p) => new RegExp(esc(p), "i")), max: 110 },

  // ---------- one workflow (Nic calls the lookout one "Lookout") ----------
  { id: "lookout-stop", ctx: { path: "/workflows/1", workflowId: 1 }, q: "Why did Lookout stop?", must: [/you (stopped|pressed stop)|stopped it yourself|you pressed|you clicked stop/i] },
  { id: "wf-what", ctx: { path: "/workflows/1", workflowId: 1 }, q: "What does this workflow do?", must: [/review/i, /ship/i] },
  { id: "wf-pr", ctx: { path: "/workflows/1", workflowId: 1 }, q: "Where's the pull request from its last run?", check: (r) => (/pull\/1\b|#1\b/.test(r.text + JSON.stringify(r.meta.chips ?? {})) ? "" : "doesn't point at pull request #1") },
  { id: "wf-change", ctx: { path: "/workflows/1", workflowId: 1 }, q: "Add a step that tests it on a phone", actions: ["change_workflow"] },
  { id: "wf-step", ctx: { path: "/workflows/1", workflowId: 1, stepId: f.wf1Review, stepLabel: "Review" }, q: "What does this step do?", must: [/review|check/i] },

  // ---------- an agent page ----------
  { id: "agent-doing", ctx: { path: `/agents/${f.arcade}`, agentId: f.arcade }, q: "What is this agent doing?", must: [/done|finished|not (running|working)|isn't (running|working)/i] },

  // ---------- words and how-to ----------
  { id: "freedom", ctx: { path: "/" }, q: "What does Freedom mean?", must: [/look only/i, /on its own/i, /check with me/i] },
  { id: "careful", ctx: { path: "/" }, q: "What does Careful mean?", must: [/review/i] },
  { id: "pr-word", ctx: { path: "/inbox" }, q: "What is a pull request?", max: 80 },
  { id: "howto-workflow", ctx: { path: "/workflows" }, q: "How do I make a workflow?", must: [/new workflow/i], max: 110 },
  { id: "usage-guard", ctx: { path: "/settings" }, q: "What does the usage limit setting do right now?", must: [f.guard ? new RegExp(`${f.guard}%`) : /(isn't|not|no) .{0,25}(set|limit|on)|off|only .{0,30}(completely|totally|fully) out/i] },

  // ---------- the open Start a task panel ----------
  { id: "panel-detailed", ctx: taskPanel("make a game"), q: "Is my goal detailed enough?", must: [/not (quite|really|yet|enough)|short|vague|more detail|too (short|general|vague)|a bit thin|needs more/i], actions: [["fill_goal", "coach_goal"]] },
  { id: "panel-better", ctx: taskPanel("make a game"), q: "Make my goal better", actions: ["fill_goal"], check: (r) => (r.meta.actions?.find((a) => a.kind === "fill_goal")?.task?.length > 80 ? "" : "the improved goal is too short") },
  { id: "panel-settings", ctx: taskPanel("make a game"), q: "Which settings should I pick?", must: [/careful|freedom|on its own/i], max: 110 },
  { id: "panel-freedom", ctx: taskPanel("make a game"), q: "What does Freedom mean?", must: [/look only/i, /on its own/i] },
  { id: "newwf-detailed", ctx: { path: "/workflows/new", editing: 'the New workflow screen. "What do you want to make?" box says: "a website" · Project: lookout · Brief: none attached', fill: 'the "What do you want to make?" box' }, q: "Is my goal detailed enough?", actions: [["fill_goal", "coach_goal"]] },

  // ---------- doing things ----------
  { id: "start-task", ctx: { path: "/" }, q: "Start a task that fixes the footer on the agentbox panel", actions: [["new_task", "coach_goal"]] },
  { id: "no-idea", ctx: { path: "/" }, q: "I don't know what to build", actions: [["idea_help", "coach_goal"]] },
  { id: "pause", ctx: { path: "/" }, q: "Pause everything", actions: ["pause_all"] },
  { id: "nightly-agent", ctx: { path: "/" }, q: "Make me an agent that checks my lookout site every night and tells me what's broken", check: (r) => ((r.meta.cards?.length || r.meta.actions?.some((a) => a.kind === "new_task")) || /\?/.test(r.text) ? "" : "no preview card, task button or question") },

  // ---------- things that don't exist ----------
  { id: "ghost-agent", ctx: { path: "/" }, q: "Why did my Weather Bot agent stop?", must: [/can't find|cannot find|couldn't find|don't see|no (agent|job)|doesn't exist|isn't (one|an agent|there)|don't have/i], noActions: ["retry_run"] },
  { id: "ghost-workflow", ctx: { path: "/" }, q: "Run my Pizza Tracker workflow", must: [/can't find|cannot find|couldn't find|don't see|no workflow|doesn't exist|isn't (one|a workflow|there)|don't have/i], noActions: ["test_run"] },

  // ---------- off-topic: one or two lines, then back to agentbox ----------
  { id: "offtopic-capital", ctx: { path: "/" }, q: "What's the capital of France?", must: [/Paris/], max: 40 },
  { id: "offtopic-essay", ctx: { path: "/" }, q: "Write me a 500-word essay about World War 2", max: 60, must: [/task|agent|agentbox|panel|project/i] },
  { id: "offtopic-weather", ctx: { path: "/" }, q: "What's the weather like today?", max: 45, mustNot: [/°|degrees|sunny|rain(y|ing)? (today|later)|cloudy/i] },
];

function esc(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function words(n) {
  return ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][n] ?? String(n);
}
