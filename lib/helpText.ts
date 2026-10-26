// The Help page text. The Helper chat reads it too, so they always say the same thing.

export const HELP_PARTS = [
  {
    icon: "sparkle",
    title: "Agents",
    text: "Every task you start becomes its own agent, named after the job. It works in its own copy of your project and then shows you the finished change to look at before anything changes for real. Careful mode has a second AI review and fix it first. Want more on the same job? Add a follow-up.",
    link: { href: "/", label: "See your agents" },
  },
  {
    icon: "flow",
    title: "Workflows",
    text: "A workflow chains steps together: research an idea, build it, have it reviewed, test it, ask you, ship it. Each step passes its work to the next. All of it ends up as one change for you to look at, so you can see every step's work in one place.",
    link: { href: "/workflows", label: "See your workflows" },
  },
  {
    icon: "inbox",
    title: "The Inbox",
    text: "Everything that needs you lands here: an agent asking for your OK, a plan to approve, a finished change to look at, or something that went wrong. Things that shipped and finished reports show up too, until you open them. Most things can be answered right there. There's also a list for jotting down ideas.",
    link: { href: "/inbox", label: "Open the Inbox" },
  },
  {
    icon: "bolt",
    title: "The usage meter",
    text: "Your Claude plan lets you use a certain amount every few hours (a session) and every week. The meter at the top shows how much of this session is used and when it resets. If you run out, nothing is lost: agents wait (\"Waiting · back at 3:00 PM\") and carry on by themselves after the reset.",
    link: { href: "/settings", label: "Usage settings" },
  },
  {
    icon: "bulb",
    title: "The Helper",
    text: "The round chat bubble in the bottom-right corner of every page. Ask it what anything means, what your agents are doing, or why something stopped (it reads the real log). It can also set up a task or draft a workflow for you to check. It only looks and suggests: nothing happens until you click.",
    link: null,
  },
];

export const HELP_WORDS: [string, string][] = [
  ["Careful / Quick", "Careful (the default): after it builds, a second AI reviews the work, it fixes what's found, polishes it and checks once more, before you see it. Quick: just does it, with one fast check at the end."],
  ["Freedom", "Look only: reads and reports. Check with me first: shows you a plan and waits. On its own: works by itself, then shows you the finished change."],
  ["Follow-up", "More work on the same job: same project, same change if you haven't put it in yet, and it knows what it did before."],
  ["Pull request", "A finished change waiting for you (GitHub calls it a pull request). Press Look at it to see what changed (with before and after pictures), then Merge it if you like it. Nothing changes in your real project until then."],
  ["Main", "The real, official version of your project. Agents never change it directly."],
  ["Merge / Ship", "Putting a finished change into the real version of your project. It asks first, unless you set a workflow's Ship step to automatic. To undo it later, start a task that says what to take out."],
  ["Project", "One app, game or website. It lives on this Mac and is saved on GitHub, a website that keeps code safe."],
  ["Test run", "Runs a workflow for real but stops before shipping and never messages you. Safe for trying things out."],
];
