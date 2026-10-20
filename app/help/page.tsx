import Link from "next/link";
import HelpTourButton from "@/components/HelpTourButton";
import { Icon, btn } from "@/components/ui";
import { listAgents } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "Help · agentbox" };

const PARTS = [
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

const WORDS = [
  ["Pull request", "A proposed change. You look at it on GitHub and press Merge if you like it. Nothing changes in your real project until then."],
  ["Main", "The real, official version of your project. Agents never change it directly."],
  ["Merge / Ship", "Putting a pull request's changes into main."],
  ["Project", "A GitHub repo copied onto this Mac, where agents do their work."],
  ["Test run", "Runs a workflow for real but stops before shipping and never messages you. Safe for trying things out."],
];

export default function Help() {
  const builder = listAgents().find((a) => a.slug === "builder") ?? listAgents().find((a) => a.kind === "claude");
  return (
    <div className="max-w-[860px]">
      <section className="pb-8 pt-10 sm:pt-14">
        <h1 className="text-[30px] font-bold leading-tight tracking-tight sm:text-[36px]">Help</h1>
        <p className="mt-2 text-[17px] text-muted">What everything is, in plain words.</p>
      </section>

      <section className="panel p-6 sm:p-8" aria-labelledby="first-h">
        <h2 id="first-h" className="text-[22px] font-bold">
          Try this first
        </h2>
        <ol className="mt-4 flex list-decimal flex-col gap-3 pl-5 text-[16px] leading-relaxed">
          <li>
            Open <Link href={builder ? `/agents/${builder.id}` : "/"} className="inline-block min-h-6 px-0.5 font-semibold underline">{builder?.name ?? "an agent"}</Link>, type a small task in <strong>Give it a task</strong> (like “make the page title friendlier”), pick <strong>Plan first</strong> and press Start. You'll see its plan before it changes anything.
          </li>
          <li>
            Go to <Link href="/workflows/new" className="inline-block min-h-6 px-0.5 font-semibold underline">New workflow</Link>, pick the <strong>Build → Review → Ship</strong> template and press <strong>Test run</strong>. Watch each step light up.
          </li>
          <li>
            Check the <Link href="/inbox" className="inline-block min-h-6 px-0.5 font-semibold underline">Inbox</Link> when the badge shows a number. Approve, send back or stop, right there.
          </li>
        </ol>
        <div className="mt-5">
          <HelpTourButton />
        </div>
      </section>

      <ul className="mt-6 grid gap-6 sm:grid-cols-2">
        {PARTS.map((p) => (
          <li key={p.title} className="panel flex flex-col gap-3 p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-soft">
              <Icon name={p.icon} color="#2F4FD8" size={22} />
            </span>
            <h2 className="text-[19px] font-semibold">{p.title}</h2>
            <p className="text-[15px] leading-relaxed text-muted">{p.text}</p>
            <Link href={p.link.href} className={btn.link + " mt-auto self-start"}>
              {p.link.label}
            </Link>
          </li>
        ))}
      </ul>

      <section className="panel mt-6 p-6 sm:p-8" aria-labelledby="words-h">
        <h2 id="words-h" className="text-[22px] font-bold">
          A few words you'll see
        </h2>
        <dl className="mt-4 flex flex-col gap-4">
          {WORDS.map(([w, d]) => (
            <div key={w}>
              <dt className="text-[16px] font-semibold">{w}</dt>
              <dd className="text-[15px] leading-relaxed text-muted">{d}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="panel mt-6 p-6 sm:p-8" aria-labelledby="safe-h">
        <h2 id="safe-h" className="text-[22px] font-bold">
          What keeps it safe
        </h2>
        <ul className="mt-4 flex list-disc flex-col gap-2 pl-5 text-[15px] leading-relaxed">
          <li>Agents work on copies. They never push to main, and never force-push, in any mode.</li>
          <li>Ship never happens on its own for agentbox itself, and only after every check passed for other projects.</li>
          <li>Every workflow has limits: how many times work can be sent back, how long a run can take, and how much usage it can use.</li>
          <li>
            <strong>Pause everything</strong> at the top stops all agents and workflows at once.
          </li>
          <li>The panel is only reachable on your own devices through Tailscale.</li>
        </ul>
      </section>
    </div>
  );
}
