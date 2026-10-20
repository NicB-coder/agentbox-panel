import type { AgentInput } from "./types";

// The starting agents. Only written to the database the very first time it is created;
// after that everything is edited in the UI.
const base = {
  project: "agentbox-panel",
  scheduleDays: [] as number[],
  scheduleTime: "02:00",
  maxMinutes: 30,
  model: "sonnet" as const,
  enabled: true,
};

export const SEED_AGENTS: { slug: string; kind: "claude" | "heartbeat"; paused: boolean; input: AgentInput }[] = [
  {
    slug: "builder",
    kind: "claude",
    paused: false,
    input: {
      ...base,
      name: "Builder",
      color: "#2F4FD8",
      icon: "hammer",
      prompt:
        "Do the task I give you. Write or fix the code it needs, keep the change small and focused, and check that it actually works before you finish (run the app or the tests if there are any). A good result is a clean pull request I can understand in two minutes. Never touch secrets or passwords, never delete things you didn't create, and never push to main.",
      scheduleKind: "manual",
      allowed: "suggest",
      mode: "auto",
      notify: ["finished", "needs_ok", "problems"],
    },
  },
  {
    slug: "reviewer",
    kind: "claude",
    paused: false,
    input: {
      ...base,
      name: "Reviewer",
      color: "#0F7B6C",
      icon: "eye",
      prompt:
        "Look at the open pull requests in this project and review them like a friendly senior developer. Point out real bugs, confusing parts and missing checks, and say what is good too. Leave your review as comments on each pull request. Never change the code yourself and never approve or merge anything.",
      scheduleKind: "manual",
      allowed: "look",
      mode: "auto",
      notify: ["finished", "problems"],
    },
  },
  {
    slug: "site-checker",
    kind: "claude",
    paused: false,
    input: {
      ...base,
      name: "Site Checker",
      color: "#C2410C",
      icon: "globe",
      prompt:
        "Open my sites in a real browser, at laptop and phone width. Check that every page loads, links work, images show up and nothing looks broken. A good result is a short list of real problems with where to find them, or \"all good\". Never change anything, never fill in forms or log in.",
      scheduleKind: "daily",
      scheduleTime: "02:00",
      allowed: "look",
      mode: "look",
      notify: ["problems"],
    },
  },
  {
    slug: "overnight",
    kind: "claude",
    paused: true,
    input: {
      ...base,
      name: "Overnight",
      color: "#7048C8",
      icon: "moon",
      prompt:
        "Make one small, safe improvement to this project: a clearer message, a fixed typo, a missing check, a tidier function. Pick something you are sure about, explain why it helps, and keep it under about 50 lines. Never change how things look or work in a big way, and never touch secrets.",
      scheduleKind: "daily",
      scheduleTime: "03:00",
      allowed: "suggest",
      mode: "auto",
      notify: ["finished", "problems"],
    },
  },
  {
    slug: "heartbeat",
    kind: "heartbeat",
    paused: false,
    input: {
      ...base,
      name: "Heartbeat",
      color: "#2B8A3E",
      icon: "heart",
      prompt: "Checks in every hour to confirm this Mac and Claude are alive, and posts to Discord.",
      project: "This Mac",
      scheduleKind: "hourly",
      allowed: "look",
      mode: "look",
      notify: [],
    },
  },
];
