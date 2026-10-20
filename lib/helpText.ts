// The Help page text. The Helper chat reads it too, so they always say the same thing.

export const HELP_PARTS = [
  {
    icon: "sparkle",
    title: "Agents",
    text: "An agent is an AI helper with one job, written in your own words. Give it a task and it works in its own copy of your project, then sends you a pull request: a proposal you can look at before anything changes for real.",
    link: { href: "/", label: "See your agents" },
  },
  {
    icon: "flow",
    title: "Workflows",
    text: "A workflow chains steps together: research an idea, build it, have it reviewed, test it, ask you, ship it. Each step passes its work to the next. All of it happens in one pull request, so you can see every step's work in one place.",
    link: { href: "/workflows", label: "See your workflows" },
  },
  {
    icon: "inbox",
    title: "The Inbox",
    text: "Everything that needs you lands here: an agent asking for your OK, a plan to approve, a pull request to look at, or something that went wrong. Most things can be answered right there. There's also a list for jotting down ideas.",
    link: { href: "/inbox", label: "Open the Inbox" },
  },
  {
    icon: "bolt",
    title: "The usage meter",
    text: "Your Claude plan lets you use a certain amount every few hours (a session) and every week. The meter at the top shows how much of this session is used and when it resets. If you run out, new runs wait and start by themselves after the reset.",
    link: { href: "/settings", label: "Usage settings" },
  },
];

export const HELP_WORDS: [string, string][] = [
  ["Pull request", "A proposed change. You look at it on GitHub and press Merge if you like it. Nothing changes in your real project until then."],
  ["Main", "The real, official version of your project. Agents never change it directly."],
  ["Merge / Ship", "Putting a pull request's changes into main."],
  ["Project", "A GitHub repo copied onto this Mac, where agents do their work."],
  ["Test run", "Runs a workflow for real but stops before shipping and never messages you. Safe for trying things out."],
];
