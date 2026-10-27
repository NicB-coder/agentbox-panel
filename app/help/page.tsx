import UpdateBox from "@/components/UpdateBox";
import Link from "next/link";
import HelpTourButton from "@/components/HelpTourButton";
import AskHelperButton from "@/components/helper/AskHelperButton";
import { Icon, btn } from "@/components/ui";
import StartTaskLink from "@/components/StartTaskLink";
import { HELP_PARTS as PARTS, HELP_WORDS as WORDS } from "@/lib/helpText";

export const dynamic = "force-dynamic";

export const metadata = { title: "Help · agentbox" };

export default function Help() {
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
            Press <StartTaskLink /> and type a small real task (like “make the page title friendlier”). Pick <strong>Check with me first</strong> and press Start. It gets its own agent, shows you its plan, and when you approve it builds, gets checked, and shows you the finished change in your Inbox.
          </li>
          <li>
            Try <strong>Research something</strong> in the same panel: ask a question you really want answered. You get a report with every source linked.
          </li>
          <li>
            Check the <Link href="/inbox" className="inline-block min-h-6 px-0.5 font-semibold underline">Inbox</Link> when the badge shows a number. Press <strong>Look at it</strong> to see what changed (with before and after pictures when it shows on the page), then <strong>Put it in my project</strong> or send it back.
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
            {p.link ? (
              <Link href={p.link.href} className={btn.link + " mt-auto self-start"}>
                {p.link.label}
              </Link>
            ) : (
              <AskHelperButton />
            )}
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

      <div className="mt-6">
        <UpdateBox />
      </div>

      <section className="panel mt-6 p-6 sm:p-8" aria-labelledby="safe-h">
        <h2 id="safe-h" className="text-[22px] font-bold">
          What keeps it safe
        </h2>
        <ul className="mt-4 flex list-disc flex-col gap-2 pl-5 text-[15px] leading-relaxed">
          <li>Agents always work on a copy. Your real project only changes when you press Put it in my project, and that always asks first.</li>
          <li>A workflow only ships by itself if you set its Ship step to automatic, and only after every check passed. agentbox never updates itself unless you said so.</li>
          <li>Connected apps (email, calendar, files…) are only used when you tick them for a task, and anything that sends, deletes or books something asks you first.</li>
          <li>If an update doesn't start properly, agentbox goes back to the old version by itself.</li>
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
