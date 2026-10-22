// Deep research: how a research session works and what its report looks like.
// Used by "Research something" tasks and by Research steps in workflows.

export const RESEARCH_METHOD = [
  "How to research (do all of it):",
  "1. Plan first: split the question into 3 to 8 sub-questions and say them in one short list.",
  "2. Search widely: several searches per sub-question, with different wordings. Prefer primary sources (official docs, the original study, the company's own page) over blogs that repeat them.",
  "3. Read the actual sources (open them with WebFetch), not just search snippets. Note the date of each source.",
  "4. Cross-check: every important claim should be backed by at least two independent sources. When sources disagree, say so and say which you trust more and why.",
  "5. For a big question, run sub-agents in parallel (the Task tool), one per sub-question, and have each one report its findings with links. Then check and combine their work yourself.",
  "6. Be honest: if something is uncertain, old, disputed or only from one source, flag it. Never invent a source or a number.",
].join("\n");

export const REPORT_FORMAT = [
  "Write the report in Markdown, for a high-school student, in plain words:",
  "# <a clear title>",
  "## Short answer",
  "<2 to 4 sentences that answer the question directly>",
  "## <one section per sub-question or theme, as many as needed>",
  "<paragraphs and lists. After every factual claim, cite its sources by number like [1] or [2][5].>",
  "## What's uncertain",
  "<a short list of things that are disputed, out of date, or only from one source. Start each line with ⚠️>",
  "## Sources",
  "1. [Title of the page](https://the.full/address) — who published it, the date, and one line on what it is",
  "2. …",
  "Number the sources in the order you first cite them. Every [n] in the text must match a source in the list.",
].join("\n");

export function researchPrompt(question: string, opts: { project?: string; brief?: boolean } = {}): string {
  return [
    `Nic's research question:\n${question}`,
    opts.brief ? "\nNic attached a brief with more detail. Read it first: .agentbox/brief.md in your folder." : "",
    opts.project ? `\nIt's for the project "${opts.project}", which is in your folder. Look at it where that helps.` : "",
    "",
    RESEARCH_METHOD,
    "",
    "Progress lines: start with PLAN: <your sub-questions, short, separated by |> and write STEP: <n> as you start each one.",
    "",
    "Your final message must be the whole report and nothing else (no PLAN, STEP or SUMMARY lines in it):",
    REPORT_FORMAT,
  ].join("\n");
}

export function researchReviewPrompt(question: string, report: string): string {
  return [
    "An AI researched a question for Nic and wrote the report below. Check it against its sources before Nic reads it.",
    "",
    `The question:\n${question}`,
    "",
    "<report>",
    report.slice(0, 60000),
    "</report>",
    "",
    "Open the cited sources (WebFetch) and check the important claims: does each source really say what the report says? Are numbers and dates right? Are any sources missing, dead, made up, or not independent? Is anything important missing or one-sided? Is the uncertain stuff flagged?",
    "Don't rewrite the report. Write a short numbered list of what must be corrected (only real problems), then end with exactly one line:",
    "VERDICT: passed",
    "or",
    "VERDICT: needs work",
  ].join("\n");
}

export function researchFixPrompt(findings: string): string {
  return `A reviewer checked your report against its sources and found these problems:\n\n${findings}\n\nCheck each one (open the sources again), fix the report, and write the whole corrected report again as your final message, in the same format.`;
}

// The report's title (its first "# " line) and short answer, for lists and notices.
export function reportTitle(md: string, fallback: string): string {
  return md.match(/^#\s+(.+)$/m)?.[1]?.trim().slice(0, 160) ?? fallback;
}

export function shortAnswer(md: string): string {
  const m = md.match(/^##\s+Short answer\s*\n+([\s\S]*?)(?=\n##\s|$)/im);
  return (m?.[1] ?? md.replace(/^#.*$/gm, "")).replace(/\[(\d+)\]/g, "").replace(/\s+/g, " ").trim().slice(0, 500);
}
