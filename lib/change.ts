import type { WorkflowInput } from "./types";
import { claudeJson } from "./claudeJson";
import { SCHEMA, stepRules } from "./draft";
import { mergeChange, type ChangeDraft } from "./changeView";
import type { AgentRef } from "./wf";

// "Change it in your own words": Claude (headless, no tools, so it can only read and answer) takes the
// workflow's steps as they are now plus Nic's sentence ("Add a step that tests it on a phone") and
// answers with the whole new list of steps. Nothing is saved here: the editor shows before → after and
// only Apply changes anything.

const CHANGE_SCHEMA = {
  ...SCHEMA,
  required: ["steps", "summary"],
  properties: {
    ...SCHEMA.properties,
    summary: { type: "string", description: "One short plain-English sentence saying what you changed, e.g. \"Added a phone check after Build.\"" },
  },
};

function instructions(agents: AgentRef[]): string {
  return [
    "You change an existing workflow for the agentbox app the way a beginner asks, in plain English. Reply only with the JSON the schema asks for: the COMPLETE new list of steps, plus a one-sentence summary of what you changed.",
    "",
    "Rules for changing:",
    "- Keep every step Nic didn't ask to change exactly as it is, with the same id and the same settings. Copy them through.",
    "- A changed step keeps its id. A new step gets a new short id like \"n1\". A removed step is simply left out.",
    "- Change only what he asked for. Don't tidy up, rename or reorder anything else, and don't add limits or settings (like a time limit) he didn't ask for.",
    "- Don't put the goal into any step: the app keeps the goal separately and gives it to every step.",
    "- If he asks for something a workflow can't do, change nothing and say so in the summary in plain words.",
    "- The summary is for a 15-year-old beginner: no jargon, no ids, no field names.",
    "",
    ...stepRules(agents),
  ].join("\n");
}

// The steps and his request are data. The goal and brief aren't sent: a change in words is about the steps.
export function changePrompt(def: WorkflowInput, text: string): string {
  const steps = def.steps.map((s, i) => (i === 0 ? { ...s, task: undefined, brief: undefined } : s));
  return [
    "This is the workflow now:",
    "<workflow>",
    JSON.stringify({ name: def.name, steps, maxLoops: def.limits.maxLoops }, null, 1),
    "</workflow>",
    "",
    "Nic wants this change:",
    "<change>",
    text,
    "</change>",
  ].join("\n");
}

export async function changeWorkflow(def: WorkflowInput, text: string, agents: AgentRef[]): Promise<ChangeDraft> {
  const fail = "Claude couldn't draft that change this time. Try again, or change the steps by clicking them.";
  const result = await claudeJson({ prompt: changePrompt(def, text), system: instructions(agents), schema: CHANGE_SCHEMA, failMessage: fail });
  if (!Array.isArray(result.steps)) throw new Error(fail);
  const d = mergeChange(def, result, agents.map((a) => a.id));
  if (d.steps.length < 2) throw new Error("That change would leave no steps after Start. Try saying it another way.");
  return d;
}
