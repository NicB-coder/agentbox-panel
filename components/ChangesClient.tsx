"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ChangesView } from "@/lib/changes";
import { plainText } from "@/lib/words";
import { BackLink, Confirm, ErrorBox, Loading, PageTitle, post } from "./bits";
import { Icon, StatusPill, btn } from "./ui";

// "See what changed": what it did in plain words, before/after pictures, the code behind a toggle, and what to do next.
export default function ChangesClient({ pr }: { pr: string }) {
  const [v, setV] = useState<ChangesView | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      const r = await fetch(`/api/changes?pr=${encodeURIComponent(pr)}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Couldn't load it.");
      setV(j);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [pr]);
  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 8000);
    return () => clearInterval(t);
  }, [load]);

  if (error && !v)
    return (
      <div className="pt-8">
        <BackLink href="/inbox">Inbox</BackLink>
        <div className="mt-6">
          <ErrorBox message={error} onRetry={load} where="See what changed" />
        </div>
      </div>
    );
  if (!v) return <Loading text="Getting the pull request from GitHub…" />;

  const state = v.state === "MERGED" ? { s: "done" as const, l: "Merged" } : v.state === "CLOSED" ? { s: "stopped" as const, l: "Closed" } : { s: "needs" as const, l: "Waiting for you" };
  return (
    <div className="pt-8">
      <BackLink href={v.run ? `/agents/${v.run.agentId}` : "/inbox"}>{v.run ? v.run.agentName : "Inbox"}</BackLink>
      <PageTitle title="See what changed" sub={<>{v.title}</>}>
        <StatusPill status={state.s} label={state.l} />
      </PageTitle>
      {msg && <p className="mb-6 rounded-[14px] bg-[#E6F4EA] px-4 py-3 text-[15px] font-medium text-[#1E6B34]" role="status">{msg}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="panel p-6 sm:p-8" aria-labelledby="what-h">
            <h2 id="what-h" className="text-[18px] font-semibold">
              What it did
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-[16px] leading-relaxed">{v.summary}</p>
            {v.careful && <p className="mt-3 text-[15px] font-semibold text-[#1E6B34]">{v.careful}</p>}
            {!v.careful && <ReviewLine review={v.review} />}
            <p className="mt-4 text-[14px] text-muted">
              {v.files.length} {v.files.length === 1 ? "file" : "files"} changed · {v.additions} lines added, {v.deletions} taken out
            </p>
          </section>

          {v.playable && v.before && v.after && <Pictures v={v} />}

          <Code pr={pr} files={v.files} />
        </div>

        <aside className="flex flex-col gap-6">
          <Actions v={v} onDone={(m) => (setMsg(m), load())} />
        </aside>
      </div>
    </div>
  );
}

function ReviewLine({ review }: { review: ChangesView["review"] }) {
  const [open, setOpen] = useState(false);
  if (!review) return null;
  if (review.status === "running") return <p className="mt-3 text-[15px] font-medium text-[#2A3F9E]">A reviewer is reading it now…</p>;
  if (!review.verdict) return null;
  return (
    <div className="mt-3">
      <p className={`text-[15px] font-semibold ${review.verdict === "passed" ? "text-[#1E6B34]" : "text-[#8A4600]"}`}>{review.verdict === "passed" ? "Reviewed ✓ Nothing to fix." : "The reviewer found things to fix."}</p>
      {review.text && (
        <>
          <button className={btn.link + " !text-[14px]"} aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? "Hide what it found" : "What it found"}
          </button>
          {open && <div className="mt-1 max-h-96 overflow-auto rounded-[14px] bg-soft p-4 text-[14px] leading-relaxed whitespace-pre-wrap">{plainText(review.text)}</div>}
        </>
      )}
    </div>
  );
}

function Pictures({ v }: { v: ChangesView }) {
  const q = `project=${v.project}&before=${v.before}&after=${v.after}&page=${encodeURIComponent(v.page)}`;
  const [state, setState] = useState<"checking" | "taking" | "ready" | "failed">("checking");
  const [size, setSize] = useState<"laptop" | "phone">("laptop");
  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await fetch(`/api/changes/shots?${q}`).then((r) => r.json()).catch(() => ({}));
      if (!alive) return;
      if (r.ready) return setState("ready");
      setState("taking");
      const t = await fetch(`/api/changes/shots?${q}`, { method: "POST" }).then((r) => r.ok).catch(() => false);
      if (alive) setState(t ? "ready" : "failed");
    })();
    return () => {
      alive = false;
    };
  }, [q]);
  return (
    <section className="panel p-6 sm:p-8" aria-labelledby="pics-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="pics-h" className="text-[18px] font-semibold">
          Before and after
        </h2>
        <div className="flex gap-1 rounded-[16px] bg-soft p-1" role="group" aria-label="Screen size">
          {(["laptop", "phone"] as const).map((s) => (
            <button key={s} type="button" aria-pressed={size === s} onClick={() => setSize(s)} className={`min-h-11 rounded-[12px] px-4 text-[14px] font-semibold ${size === s ? "bg-white shadow-[0_1px_3px_rgba(21,23,27,0.12)]" : "text-muted"}`}>
              {s === "laptop" ? "Laptop" : "Phone"}
            </button>
          ))}
        </div>
      </div>
      {state === "ready" ? (
        <div className={`mt-4 grid gap-4 ${size === "phone" ? "grid-cols-2" : "md:grid-cols-2"}`}>
          {(["before", "after"] as const).map((w) => (
            <figure key={w} className="min-w-0">
              <figcaption className="mb-2 text-[14px] font-semibold">{w === "before" ? "Before" : "After"}</figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/changes/shots?${q}&name=${w}-${size}`} alt={`${w === "before" ? "Before" : "After"} the change, ${size} width`} className="w-full rounded-[14px] border border-line" />
            </figure>
          ))}
        </div>
      ) : state === "failed" ? (
        <p className="mt-3 text-[15px] text-muted">Couldn't take the pictures this time. You can still open it below.</p>
      ) : (
        <Loading text={state === "taking" ? "Opening both versions in a browser and taking pictures…" : "Checking…"} />
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <a href={`/preview/${v.project}/${v.after}/${v.page}`} target="_blank" rel="noreferrer" className={btn.primary}>
          <Icon name="play" color="#fff" size={16} /> {v.state === "MERGED" ? "Play it" : "Try the new version"}
        </a>
        <a href={`/preview/${v.project}/${v.before}/${v.page}`} target="_blank" rel="noreferrer" className={btn.secondary}>
          Open the old version
        </a>
      </div>
    </section>
  );
}

function Code({ pr, files }: { pr: string; files: ChangesView["files"] }) {
  const [open, setOpen] = useState(false);
  const [diff, setDiff] = useState<string | null>(null);
  async function toggle() {
    setOpen(!open);
    if (!open && diff === null) setDiff(await fetch(`/api/changes/diff?pr=${encodeURIComponent(pr)}`).then((r) => r.text()).catch(() => ""));
  }
  return (
    <section>
      <button className={btn.secondary} aria-expanded={open} onClick={toggle}>
        {open ? "Hide the code changes" : "Show the code changes"}
      </button>
      {open && (
        <div className="panel mt-4 p-4 sm:p-6">
          <ul className="mb-4 flex flex-col gap-1 text-[14px]">
            {files.map((f) => (
              <li key={f.path} className="flex justify-between gap-3">
                <span className="truncate">{f.path}</span>
                <span className="shrink-0 text-muted">
                  <span className="text-[#1E6B34]">+{f.additions}</span> <span className="text-[#A11B12]">−{f.deletions}</span>
                </span>
              </li>
            ))}
          </ul>
          {diff === null ? (
            <Loading />
          ) : (
            <pre className="max-h-[40rem] overflow-auto rounded-[14px] bg-soft p-4 text-[12px] leading-relaxed">
              {diff.split("\n").map((l, i) => (
                <span
                  key={i}
                  className={`block ${l.startsWith("diff --git") ? "mt-3 font-bold" : l.startsWith("+") && !l.startsWith("+++") ? "bg-[#E6F4EA] text-[#1E6B34]" : l.startsWith("-") && !l.startsWith("---") ? "bg-[#FDE8E6] text-[#A11B12]" : l.startsWith("@@") ? "text-[#2A3F9E]" : ""}`}
                >
                  {l || " "}
                </span>
              ))}
            </pre>
          )}
        </div>
      )}
    </section>
  );
}

function Actions({ v, onDone }: { v: ChangesView; onDone: (msg: string) => void }) {
  const [mode, setMode] = useState<"" | "comment" | "back">("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState(false);
  async function go(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    setErr("");
    try {
      await fn();
      setText("");
      setMode("");
      onDone(done);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const open = v.state === "OPEN";
  const needsFix = v.review?.verdict === "needs work" && !v.careful;
  return (
    <section className="panel flex flex-col gap-3 p-6" aria-labelledby="next-h">
      <h2 id="next-h" className="text-[18px] font-semibold">
        What next?
      </h2>
      {open && v.run && (
        <button className={btn.primary} disabled={busy} onClick={() => setConfirm(true)}>
          Merge it
        </button>
      )}
      {open && needsFix && (
        <button className={btn.secondary} disabled={busy} onClick={() => go(() => (v.run ? post(`/api/runs/${v.run.id}/send-back`, {}) : post("/api/changes/fix", { pr: v.prUrl })), "Sent back. An agent is fixing what the reviewer found.")}>
          Send back to fix
        </button>
      )}
      {open && (
        <button className={btn.secondary} disabled={busy} aria-expanded={mode === "back"} onClick={() => setMode(mode === "back" ? "" : "back")}>
          Send back with a note
        </button>
      )}
      <button className={btn.secondary} disabled={busy} aria-expanded={mode === "comment"} onClick={() => setMode(mode === "comment" ? "" : "comment")}>
        Comment
      </button>
      {mode && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return setErr("Write something first.");
            if (mode === "comment") go(() => post("/api/changes/comment", { pr: v.prUrl, body: text }), "Your comment is on the pull request.");
            else go(() => (v.run ? post(`/api/runs/${v.run.id}/send-back`, { note: text }) : post("/api/changes/fix", { pr: v.prUrl, note: text })), "Sent back with your note. It's working on it.");
          }}
        >
          <label className="flex flex-col gap-2">
            <span className="text-[15px] font-semibold">{mode === "comment" ? "Your comment" : "What should it change?"}</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="rounded-[14px] border border-[#C9CDD4] p-3 text-[15px]" />
          </label>
          <button type="submit" className={btn.primary} disabled={busy}>
            {mode === "comment" ? "Post comment" : "Send it back"}
          </button>
        </form>
      )}
      {err && (
        <p role="alert" className="text-[14px] font-medium text-[#A11B12]">
          {err}
        </p>
      )}
      <a href={v.prUrl} target="_blank" rel="noreferrer" className={btn.link}>
        Open it on GitHub
      </a>
      {v.run && (
        <Link href={`/agents/${v.run.agentId}`} className={btn.link}>
          Go to {v.run.agentName}
        </Link>
      )}
      <Confirm
        open={confirm}
        title="Merge this pull request?"
        text="Its changes go into main, the real version of your project. You can't undo this from here."
        yes="Merge it"
        onYes={() => {
          setConfirm(false);
          if (v.run) go(() => post(`/api/runs/${v.run!.id}/merge`), "Merged into main.");
        }}
        onClose={() => setConfirm(false)}
      />
    </section>
  );
}
