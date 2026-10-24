"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import type { HelperAction, HelperCard, HelperMessage } from "@/lib/helperTypes";
import { Confirm, post } from "../bits";
import { refreshHeader } from "../Header";
import { openNewTask, openTaskPanel } from "../TaskPanel";
import { AgentIcon, Icon, btn } from "../ui";

// One message in the Helper chat: plain paragraphs and bullets, clickable chips,
// suggested action buttons and preview cards.

type ChipInfo = { href: string; label: string; external?: boolean } | null;

const CHIP_ICON: Record<string, string> = { agent: "sparkle", run: "play", workflow: "flow", wfrun: "flow", pr: "check", page: "book" };

// While a reply streams in, hide markup that isn't finished yet.
export function streamingText(raw: string): { text: string; preparing: boolean } {
  let text = raw;
  let preparing = false;
  const fence = text.search(/```(agent-preview|workflow-preview)/);
  if (fence >= 0) {
    const closed = /```(agent-preview|workflow-preview)[\s\S]*?```/.test(text.slice(fence));
    if (!closed) {
      text = text.slice(0, fence);
      preparing = true;
    }
    text = text.replace(/```(agent-preview|workflow-preview)[\s\S]*?```/g, "");
  }
  text = text.replace(/\[\[(button|task):[^\]]*\]\]/g, "");
  const open = text.lastIndexOf("[[");
  if (open >= 0 && text.indexOf("]]", open) < 0) text = text.slice(0, open);
  return { text: text.replace(/\n{3,}/g, "\n\n"), preparing };
}

// Replies appear word by word at a calm, even pace, however fast they really arrive.
// About 13 words a second; a little quicker only when far behind, so a long reply doesn't drag.
const WORD_MS = 75;
const nextWord = /\s*\S+/y;

function useCalmReveal(full: string, animate: boolean): { text: string; caughtUp: boolean } {
  const [pos, setPos] = useState(0);
  const calm = animate && !(typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const behind = calm && pos < full.length;
  useEffect(() => {
    if (!behind) return;
    const t = setInterval(() => {
      setPos((p) => {
        const left = full.length - p;
        let n = left > 1500 ? 4 : left > 600 ? 2 : 1;
        let at = Math.min(p, full.length);
        while (n-- > 0 && at < full.length) {
          nextWord.lastIndex = at;
          at = nextWord.exec(full) ? nextWord.lastIndex : full.length;
        }
        return at;
      });
    }, WORD_MS);
    return () => clearInterval(t);
  }, [behind, full]);
  return calm ? { text: full.slice(0, pos), caughtUp: pos >= full.length } : { text: full, caughtUp: true };
}

// A chip's link before the server has checked it (while streaming).
function guessChip(kind: string, ref: string, label: string): ChipInfo {
  if (kind === "agent" && /^\d+$/.test(ref)) return { href: `/agents/${ref}`, label };
  if (kind === "workflow" && /^\d+$/.test(ref)) return { href: `/workflows/${ref}`, label };
  if (kind === "page" && ref.startsWith("/")) return { href: ref, label };
  if (kind === "pr" && ref.startsWith("https://github.com/")) return { href: ref, label, external: true };
  return null;
}

function Chip({ kind, info, label, onNavigate }: { kind: string; info: ChipInfo; label: string; onNavigate: () => void }) {
  const cls = "mx-0.5 inline-flex min-h-8 items-center gap-1 rounded-full border border-[#C9CDD4] bg-white px-2.5 py-0.5 align-middle text-[14px] font-semibold leading-tight text-ink hover:bg-soft";
  const inner = (
    <>
      <Icon name={CHIP_ICON[kind] ?? "sparkle"} color="#2F4FD8" size={13} />
      <span>{label}</span>
    </>
  );
  if (!info) return <span className={cls + " !font-medium"}>{inner}</span>;
  if (info.external)
    return (
      <a href={info.href} target="_blank" rel="noreferrer" className={cls}>
        {inner}
        <span aria-hidden="true">↗</span>
        <span className="sr-only"> (opens GitHub)</span>
      </a>
    );
  return (
    <Link href={info.href} className={cls} onClick={onNavigate}>
      {inner}
    </Link>
  );
}

function inline(text: string, chips: Record<string, ChipInfo> | undefined, onNavigate: () => void, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[\[([a-z]+):([^\]|]*)\|([^\]]*)\]\]|\*\*([^*]+)\*\*|(?:^|(?<=\s))[_*]([^_*\n]+)[_*](?=\s|$|[.,!?])|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[1]) {
      const ckey = `${m[1]}:${m[2]}`;
      const info = chips && ckey in chips ? chips[ckey] : guessChip(m[1], m[2], m[3]);
      out.push(<Chip key={k} kind={m[1]} info={info} label={m[3] || info?.label || ""} onNavigate={onNavigate} />);
    } else if (m[4]) out.push(<strong key={k}>{m[4]}</strong>);
    else if (m[5]) out.push(<em key={k}>{m[5]}</em>);
    else if (m[6]) out.push(<Fragment key={k}>{m[6]}</Fragment>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function RichText({ text, chips, onNavigate }: { text: string; chips?: Record<string, ChipInfo>; onNavigate: () => void }) {
  const blocks = text.split(/\n{2,}/).filter((b) => b.trim());
  return (
    <>
      {blocks.map((b, bi) => {
        const lines = b.split("\n").filter((l) => l.trim());
        const bullet = (l: string) => /^\s*([-*•]|\d+[.)])\s+/.test(l);
        if (lines.length && lines.every(bullet)) {
          const ordered = /^\s*\d/.test(lines[0]);
          const items = lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ""), chips, onNavigate, `${bi}-${li}`)}</li>);
          return ordered ? (
            <ol key={bi} className="flex list-decimal flex-col gap-1 pl-5">
              {items}
            </ol>
          ) : (
            <ul key={bi} className="flex list-disc flex-col gap-1 pl-5">
              {items}
            </ul>
          );
        }
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {inline(l.replace(/^#+\s*/, ""), chips, onNavigate, `${bi}-${li}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}

// ---------- action buttons ----------

function ActionButton({ a, onNavigate }: { a: HelperAction; onNavigate: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState(false);
  const nav = a.kind === "open" || a.kind === "test_run" || a.kind === "new_task" || a.kind === "coach_goal" || a.kind === "idea_help";

  async function go() {
    setConfirm(false);
    setErr("");
    if (a.kind === "open") {
      router.push(a.ref);
      onNavigate();
      return;
    }
    if (a.kind === "test_run") {
      router.push(`/workflows/${a.ref}?test=1`);
      onNavigate();
      return;
    }
    if (a.kind === "coach_goal" || a.kind === "idea_help") {
      openTaskPanel(a.kind === "coach_goal" ? { task: a.task ?? "", coach: true } : { ideas: true });
      return;
    }
    if (a.kind === "new_task") {
      openNewTask({ task: a.task ?? "", agentId: Number(a.ref) });
      return;
    }
    setState("busy");
    try {
      const n = a.ref;
      const calls: Record<string, () => Promise<unknown>> = {
        retry_run: () => post(`/api/runs/${n}/retry`),
        approve_plan: () => post(`/api/runs/${n}/plan`, { approve: true }),
        allow: () => post(`/api/approvals/${n}`, { allow: true }),
        deny: () => post(`/api/approvals/${n}`, { allow: false }),
        run_agent: () => post(`/api/agents/${n}/run`, {}),
        resume_wfrun: () => post(`/api/workflow-runs/${n}/resume`),
        approve_wfrun: () => post(`/api/workflow-runs/${n}/answer`, { action: "approve" }),
        ship_wfrun: () => post(`/api/workflow-runs/${n}/answer`, { action: "approve" }),
        merge_pr: () => post(`/api/runs/${n}/merge`),
        pause_all: () => post("/api/pause-all", { paused: true }),
        resume_all: () => post("/api/pause-all", { paused: false }),
      };
      await calls[a.kind]?.();
      setState("done");
      refreshHeader();
      window.dispatchEvent(new Event("agentbox:changed"));
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
      setState("idle");
    }
  }

  return (
    <>
      <button
        type="button"
        className={`${a.risky ? btn.danger : nav ? btn.secondary : btn.primary} !min-h-11 !rounded-full !px-4 !text-[14px]`}
        disabled={state !== "idle"}
        onClick={() => (a.risky ? setConfirm(true) : go())}
      >
        {state === "done" ? `✓ ${doneWord(a)}` : state === "busy" ? "One moment…" : a.label}
      </button>
      {err && (
        <p role="alert" className="w-full text-[14px] font-medium text-[#A11B12]">
          {err}
        </p>
      )}
      {a.risky && (
        <Confirm open={confirm} title="Are you sure?" text={a.confirm} yes={a.label} danger onYes={go} onClose={() => setConfirm(false)} />
      )}
    </>
  );
}

function doneWord(a: HelperAction) {
  return (
    { retry_run: "Started again", approve_plan: "Plan approved", allow: "Allowed", deny: "Denied", run_agent: "Started", resume_wfrun: "Picked up again", approve_wfrun: "Approved", ship_wfrun: "Shipping", merge_pr: "Merged", pause_all: "Everything paused", resume_all: "Resumed" } as Record<string, string>
  )[a.kind] ?? "Done";
}

// ---------- preview cards ----------

function Card({ card, msgId, index, created, onChange, onNavigate }: { card: HelperCard; msgId: number; index: number; created?: { href: string }; onChange: () => void; onNavigate: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function create() {
    setBusy(true);
    setErr("");
    try {
      const j = await post<{ href: string }>("/api/helper/create", { msgId, index });
      window.dispatchEvent(new Event("agentbox:helper-reload"));
      window.dispatchEvent(new Event("agentbox:changed"));
      router.push(j.href);
      onNavigate();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const isAgent = card.type === "agent";
  return (
    <div className="mt-1 overflow-hidden rounded-[20px] border border-[rgba(21,23,27,0.28)] bg-white text-ink">
      <div className="h-1.5" style={{ background: isAgent ? card.draft.color : "#7048C8", opacity: 0.55 }} aria-hidden="true" />
      <div className="flex flex-col gap-3 p-4">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">{isAgent ? "New agent · preview" : "New workflow · preview"}</p>
        <div className="flex items-center gap-3">
          {isAgent ? <AgentIcon name={card.draft.icon} color={card.draft.color} size={40} /> : <AgentIcon name="flow" color="#7048C8" size={40} />}
          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold">{card.draft.name}</p>
            <p className="text-[13px] text-muted">{card.draft.project}</p>
          </div>
        </div>
        {card.type === "workflow" && (
          <ol className="flex flex-wrap items-center gap-x-1 gap-y-2" aria-label="Steps">
            {card.steps.map((s, i) => (
              <li key={i} className="flex items-center gap-1 text-[13px] font-medium">
                {i > 0 && (
                  <span aria-hidden="true" className="text-muted">
                    →
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full bg-soft px-2 py-1">
                  <Icon name={s.icon} color={s.color} size={13} />
                  {s.title}
                </span>
              </li>
            ))}
          </ol>
        )}
        {card.sentence && <p className="text-[14px] leading-snug">{card.sentence}</p>}
        {isAgent && card.draft.prompt && <p className="clamp-3 text-[14px] leading-snug text-muted">“{card.draft.prompt}”</p>}
        {card.problem ? (
          <p className="rounded-[12px] bg-[#FDF0DC] px-3 py-2 text-[14px] font-medium text-[#8A4600]">{card.problem} Press Change it and tell me.</p>
        ) : (
          <p className="text-[13px] text-muted">It's saved switched Off, so nothing runs until you turn it on.</p>
        )}
        {created ? (
          <Link href={created.href} className={btn.secondary + " !min-h-11 !rounded-full"} onClick={onNavigate}>
            ✓ Created. Open it
          </Link>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn.primary + " !min-h-11 !rounded-full"} onClick={create} disabled={busy || !!card.problem}>
              {busy ? "Creating…" : "Create it"}
            </button>
            <button type="button" className={btn.secondary + " !min-h-11 !rounded-full"} onClick={onChange}>
              Change it
            </button>
          </div>
        )}
        {err && (
          <p role="alert" className="text-[14px] font-medium text-[#A11B12]">
            {err}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------- one message ----------

export function MessageView({
  m, live, status, animate, onChange, onNavigate,
}: { m: HelperMessage; live?: string; status?: string; animate?: boolean; onChange: () => void; onNavigate: () => void }) {
  const writing = m.status === "streaming";
  // What there is to show so far (unfinished cards and buttons hidden), typed out calmly.
  const sofar = m.role !== "helper" ? { text: "", preparing: false } : writing ? streamingText(live ?? m.text) : { text: m.text, preparing: false };
  const reveal = useCalmReveal(sofar.text, !!animate);
  if (m.role === "user") {
    return (
      <li className="flex flex-col items-end gap-1">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-[20px] rounded-br-[6px] bg-ink px-4 py-2.5 text-[15px] leading-snug text-white">{m.text}</div>
        {m.meta.context && <span className="pr-1 text-[12px] text-muted">on {m.meta.context}</span>}
      </li>
    );
  }
  // Still typing out a reply that has already finished: buttons and cards show once it's all there.
  const streaming = writing || !reveal.caughtUp;
  const shown = streaming ? { text: streamingText(reveal.text).text, preparing: sofar.preparing } : { text: m.text, preparing: false };
  const meta = m.meta;
  return (
    <li className="flex flex-col items-start gap-2">
      <span className="sr-only">Helper:</span>
      {(shown.text || !streaming) && (
        <div
          className={`flex max-w-[92%] flex-col gap-2.5 break-words rounded-[20px] rounded-bl-[6px] px-4 py-3 text-[15px] leading-relaxed ${m.status === "error" ? "bg-[#FDE8E6] text-[#A11B12]" : "bg-[#F1F2F4] text-ink"}`}
        >
          <RichText text={shown.text} chips={writing ? undefined : meta.chips} onNavigate={onNavigate} />
        </div>
      )}
      {streaming && (
        <p className="flex items-center gap-2 pl-1 text-[14px] text-muted" role="status">
          <span className="pulse h-2 w-2 rounded-full bg-[#9AA0A8]" aria-hidden="true" />
          {(writing && status) || (shown.preparing || (!writing && m.meta.cards?.length) ? "Preparing a preview…" : shown.text ? "Writing…" : "Thinking…")}
        </p>
      )}
      {!streaming && meta.cards?.map((c, i) => (
        <div key={i} className="w-full max-w-[92%]">
          <Card card={c} msgId={m.id} index={i} created={meta.created?.find((x) => x.index === i)} onChange={onChange} onNavigate={onNavigate} />
        </div>
      ))}
      {!streaming && !!meta.actions?.length && (
        <div className="flex max-w-full flex-wrap gap-2">
          {meta.actions.map((a, i) => (
            <ActionButton key={i} a={a} onNavigate={onNavigate} />
          ))}
        </div>
      )}
      {!streaming && !!meta.tools?.length && <p className="pl-1 text-[12px] text-muted">Looked at: {meta.tools.map((t) => t.replace(/^(Reading|Looking at|Checking) /, "")).join(", ")}</p>}
    </li>
  );
}
