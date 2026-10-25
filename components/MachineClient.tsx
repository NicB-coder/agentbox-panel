"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import type { MachineInfo } from "@/lib/machine";
import { ago, duration } from "@/lib/words";

const longTime = (ms: number) => (ms > 2 * 86400_000 ? `${Math.floor(ms / 86400_000)} days` : duration(ms));
import { InfoTip, PageTitle } from "./bits";
import { btn } from "./ui";
import { usePoll } from "./usePoll";

const SIGN_IN = {
  claude: "claude auth login",
  github: "gh auth login --hostname github.com --git-protocol https --web",
};

export default function MachineClient({ initial }: { initial: MachineInfo }) {
  const { data: m } = usePoll<MachineInfo>("/api/machine", initial, 15_000);
  const now = Date.now();
  return (
    <div>
      <PageTitle title="Machine" sub={`How ${m.name} is doing.`} />
      {m.disk.low && (
        <p role="alert" className="mb-6 rounded-[14px] bg-[#FDE8E6] px-4 py-3 text-[15px] font-semibold text-[#A11B12]">
          Disk space is running low: {m.disk.freeGb} GB left. Old copies of projects are tidied up 3 days after a run ends; archiving finished jobs helps too.
        </p>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Power">
          {m.battery ? (
            <>
              <Big>{m.battery.pct}%</Big>
              <Bar pct={m.battery.pct ?? 0} color={m.battery.pct !== null && m.battery.pct < 20 && !m.battery.plugged ? "#C8281C" : "#1F9D55"} />
              <Line>{m.battery.text}</Line>
            </>
          ) : (
            <Line>No battery (always plugged in)</Line>
          )}
        </Card>
        <Card title="Disk space" tip="Free space on this Mac. Agents work in their own copies of your projects, which take space until they're tidied up.">
          <Big>{m.disk.freeGb} GB free</Big>
          <Bar pct={m.disk.usedPct} color={m.disk.low ? "#C8281C" : m.disk.usedPct > 80 ? "#B45309" : "#2F4FD8"} />
          <Line>
            {m.disk.usedPct}% of {m.disk.totalGb} GB used{m.disk.copiesGb !== null ? ` · agents' copies: ${m.disk.copiesGb} GB` : ""}
          </Line>
        </Card>
        <Card title="Running since">
          <Big>{m.bootedAt ? longTime(now - m.bootedAt) : "Unknown"}</Big>
          <Line>{m.bootedAt ? `Last restart ${ago(m.bootedAt, now)} (${new Date(m.bootedAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })})` : ""}</Line>
          <Line>The panel started {ago(m.panelStartedAt, now)}.</Line>
        </Card>
        <Card title="Private network (Tailscale)" tip="Tailscale is the private network that lets you open the panel from your phone and laptop. Nobody else can reach it.">
          <Big>
            <Dot ok={m.tailscale.connected} /> {m.tailscale.text}
          </Big>
          {m.tailscale.name && <Line>Its address on your network: {m.tailscale.name}</Line>}
        </Card>
        <Card title="Heartbeat" tip="The hourly check-in job that proves this Mac and Claude are alive.">
          <Big>
            <Dot ok={m.heartbeat.ok} /> {m.heartbeat.ok ? "Checking in" : "Missed check-ins"}
          </Big>
          <Line>{m.heartbeat.text}</Line>
          {m.heartbeatId && (
            <Link href={`/agents/${m.heartbeatId}`} className={btn.link}>
              Open Heartbeat
            </Link>
          )}
        </Card>
        <Card title="Version" tip="Which version of agentbox is running. Update it from Settings.">
          <Big>{m.version ? `From ${new Date(m.version.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "Unknown"}</Big>
          {m.version && (
            <details className="text-[14px] text-muted">
              <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium">Details</summary>
              Version {m.version.commit}
              {m.version.branch !== "main" ? ` · branch ${m.version.branch}` : ""}
            </details>
          )}
          <Link href="/settings#update" className={btn.link}>
            Update agentbox
          </Link>
        </Card>
      </div>

      <section id="accounts" className="panel mt-6 scroll-mt-24 p-6 sm:p-8" aria-labelledby="acc-h">
        <h2 id="acc-h" className="flex items-center text-[18px] font-semibold">
          Signed in
          <InfoTip text="The accounts agents use. If one says Not signed in, agents can't work until you sign in again." label="Signed in" />
        </h2>
        <ul className="mt-3 divide-y divide-line">
          <Account name="Claude" ok={m.claude.signedIn} text={m.claude.text} cmd={SIGN_IN.claude} how="Opens a sign-in link. Open it, sign in with your Claude account, and paste the code back if it asks." />
          <Account name="GitHub (the bot)" ok={m.github.signedIn} text={m.github.text} cmd={SIGN_IN.github} how="Shows a one-time code. Open github.com/login/device signed in as the bot, and type the code." />
          <li className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[15px] font-semibold">Discord messages</span>
            <span className="text-[15px] text-muted">
              <Dot ok={m.discord} /> {m.discord ? "Set up" : "Not set up"}
            </span>
          </li>
          <li className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[15px] font-semibold">People logged in to this Mac</span>
            <span className="text-[15px] text-muted">{m.macUsers.length ? m.macUsers.join(", ") : "Nobody at the screen"}</span>
          </li>
        </ul>
      </section>
    </div>
  );
}

function Account({ name, ok, text, cmd, how }: { name: string; ok: boolean; text: string; cmd: string; how: string }) {
  return (
    <li className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
      <span>
        <span className="block text-[15px] font-semibold">{name}</span>
        <span className="text-[15px] text-muted">
          <Dot ok={ok} /> {text}
        </span>
      </span>
      <span className="flex items-center">
        <Link href={`/terminal?cmd=${encodeURIComponent(cmd)}`} className={ok ? btn.secondary : btn.primary}>
          {ok ? "Sign in again" : "Sign in"}
        </Link>
        <InfoTip text={`${how} It opens the Terminal with the command typed in; press Enter to start.`} label={`Sign in to ${name}`} />
      </span>
    </li>
  );
}

function Card({ title, tip, children }: { title: string; tip?: string; children: ReactNode }) {
  return (
    <section className="panel flex flex-col gap-2 p-6">
      <h2 className="flex items-center text-[15px] font-semibold text-muted">
        {title}
        {tip && <InfoTip text={tip} label={title} />}
      </h2>
      {children}
    </section>
  );
}
const Big = ({ children }: { children: ReactNode }) => <p className="flex items-center gap-2 text-[24px] font-bold tracking-tight">{children}</p>;
const Line = ({ children }: { children: ReactNode }) => <p className="text-[15px] text-muted">{children}</p>;
const Dot = ({ ok }: { ok: boolean }) => <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${ok ? "bg-[#1F9D55]" : "bg-[#C8281C]"}`} aria-label={ok ? "OK" : "Problem"} role="img" />;
function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <span className="block h-2 overflow-hidden rounded-full bg-[#E6E8EC]" aria-hidden="true">
      <span className="block h-full rounded-full" style={{ width: `${Math.min(100, Math.max(2, pct))}%`, background: color }} />
    </span>
  );
}
