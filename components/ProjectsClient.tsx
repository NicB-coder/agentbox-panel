"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ProjectInfo } from "@/lib/projectsAdmin";
import { ago } from "@/lib/words";
import { Confirm, EmptyState, ErrorBox, InfoTip, Loading, PageTitle, post } from "./bits";
import { Icon, btn, field } from "./ui";

export default function ProjectsClient({ initial }: { initial: ProjectInfo[] }) {
  const router = useRouter();
  const [list, setList] = useState(initial);
  const [repos, setRepos] = useState<{ name: string; description: string }[] | null>(null);
  const [typed, setTyped] = useState("");
  const [picked, setPicked] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [confirmNew, setConfirmNew] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<{ msg: string; retry: () => void } | null>(null);
  const [done, setDone] = useState("");
  // "Add to project" from a run that couldn't find a file: /projects?add=lookout&file=CLAUDE.md
  const [want, setWant] = useState<{ project: string; file: string } | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const project = q.get("add");
    if (!project) return;
    setWant({ project, file: q.get("file") ?? "" });
    setTimeout(() => document.getElementById(`project-${project}`)?.scrollIntoView({ block: "center" }), 50);
  }, []);

  // The page may have shown what the panel knew a minute ago; pick up the newer copy once it's in.
  useEffect(() => {
    const t = setTimeout(() => {
      fetch("/api/projects", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((l) => l && setList(l))
        .catch(() => {});
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    fetch("/api/projects/repos", { cache: "no-store" })
      .then((r) => r.json())
      .then((r) => {
        setRepos(r);
        if (r[0]) setPicked(r[0].name);
      })
      .catch(() => setRepos([]));
  }, []);

  async function reload() {
    const r = await fetch("/api/projects?fresh=1", { cache: "no-store" });
    if (r.ok) setList(await r.json());
    router.refresh();
  }

  async function clone(repo: string) {
    if (!repo.trim()) return setError({ msg: "Type a repo like owner/name first.", retry: () => clone(repo) });
    setBusy("clone");
    setError(null);
    setDone("");
    try {
      const j = await post<{ name: string }>("/api/projects/clone", { repo });
      setDone(`${j.name} is ready. You can pick it in any project list now.`);
      setTyped("");
      setRepos((r) => r?.filter((x) => x.name !== repo) ?? r);
      await reload();
    } catch (e) {
      setError({ msg: (e as Error).message, retry: () => clone(repo) });
    } finally {
      setBusy("");
    }
  }

  async function create() {
    setConfirmNew(false);
    setBusy("create");
    setError(null);
    setDone("");
    try {
      const j = await post<{ name: string }>("/api/projects/create", { name: newName, description: newDesc });
      setDone(`Made ${j.name} on GitHub and copied it here.`);
      setNewName("");
      setNewDesc("");
      await reload();
    } catch (e) {
      setError({ msg: (e as Error).message, retry: create });
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <PageTitle title="Projects" sub="The code your agents and workflows work on. Each one is a GitHub repo copied onto this Mac." />
      {error && (
        <div className="mb-6">
          <ErrorBox message={error.msg} onRetry={error.retry} where="Projects" />
        </div>
      )}
      {done && (
        <p role="status" className="mb-6 rounded-[14px] bg-[#E6F4EA] px-4 py-3 text-[15px] font-semibold text-[#1E6B34]">
          {done}
        </p>
      )}

      <section aria-labelledby="have-h">
        <h2 id="have-h" className="text-[22px] font-bold">
          On this Mac
        </h2>
        {list.length === 0 ? (
          <div className="mt-4">
            <EmptyState icon="folder" title="No projects yet" text="Add one below: paste a GitHub repo, pick one of the bot's, or make a brand new one." />
          </div>
        ) : (
          <ul className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-2">
            {list.map((p) => (
              <li key={p.name} id={`project-${p.name}`} className={`panel flex flex-col gap-3 p-6 ${want?.project === p.name ? "ring-2 ring-[#2F4FD8]" : ""}`}>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-soft">
                    <Icon name="folder" color="#555A63" size={20} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[17px] font-semibold">{p.name}</p>
                    {p.url ? (
                      <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex min-h-6 items-center text-[13px] text-muted underline">
                        {p.repo} on GitHub
                      </a>
                    ) : (
                      <p className="text-[13px] text-muted">Not linked to GitHub</p>
                    )}
                  </div>
                </div>
                {p.playable && (
                  <div>
                    <a href={`/preview/${p.name}/live/`} target="_blank" rel="noreferrer" className={btn.primary}>
                      <Icon name="play" color="#fff" size={16} /> Play
                    </a>
                  </div>
                )}
                <p className="text-[14px] text-muted">
                  {p.lastActivity ? `Last change ${ago(p.lastActivity)}${p.lastMessage ? `: “${p.lastMessage.slice(0, 80)}”` : ""}` : "No changes yet"}
                </p>
                <div>
                  <p className="text-[14px] font-semibold">
                    {p.prs.length ? `${p.prs.length} open pull request${p.prs.length === 1 ? "" : "s"}` : "No open pull requests"}
                  </p>
                  {p.prs.length > 0 && (
                    <ul className="mt-1 flex flex-col">
                      {p.prs.slice(0, 5).map((pr) => (
                        <li key={pr.number}>
                          <a href={`/changes?pr=${encodeURIComponent(pr.url)}`} className="flex min-h-11 items-center gap-2 text-[14px] underline">
                            <span className="truncate">
                              #{pr.number} {pr.title}
                            </span>
                            {pr.draft && <span className="shrink-0 rounded-full bg-soft px-2 text-[12px] font-semibold text-[#4A4F57] no-underline">draft</span>}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <AddFile project={p.name} want={want?.project === p.name ? want.file : ""} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12" aria-labelledby="add-h">
        <h2 id="add-h" className="text-[22px] font-bold">
          Add a project
        </h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <form
            className="panel flex flex-col gap-3 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              clone(typed);
            }}
          >
            <h3 className="flex items-center text-[17px] font-semibold">
              Paste a GitHub repo
              <InfoTip text="The part of the address after github.com, like NicB-coder/portfolio. The bot needs to be able to see it." label="Paste a GitHub repo" />
            </h3>
            <label className="flex flex-col gap-2">
              <span className="text-[14px] font-semibold">Repo (owner/name)</span>
              <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="NicB-coder/portfolio" className={`${field} min-h-11`} />
            </label>
            <button type="submit" className={btn.primary + " mt-auto"} disabled={!!busy}>
              {busy === "clone" ? "Copying…" : "Add it"}
            </button>
          </form>

          <div className="panel flex flex-col gap-3 p-6">
            <h3 className="flex items-center text-[17px] font-semibold">
              Pick one of the bot's repos
              <InfoTip text="Repos the bot account owns or was invited to, that aren't on this Mac yet." label="Pick one of the bot's repos" />
            </h3>
            {repos === null ? (
              <Loading text="Asking GitHub…" />
            ) : repos.length === 0 ? (
              <p className="text-[14px] text-muted">There aren't any others. Every repo the bot can see is already here.</p>
            ) : (
              <>
                <label className="flex flex-col gap-2">
                  <span className="text-[14px] font-semibold">Repo</span>
                  <select value={picked} onChange={(e) => setPicked(e.target.value)} className={`${field} min-h-11`}>
                    {repos.map((r) => (
                      <option key={r.name} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className={btn.primary + " mt-auto"} disabled={!!busy || !picked} onClick={() => clone(picked)}>
                  {busy === "clone" ? "Copying…" : "Add it"}
                </button>
              </>
            )}
          </div>

          <form
            className="panel flex flex-col gap-3 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newName.trim()) return setError({ msg: "Give the new repo a name, like my-first-site.", retry: () => setError(null) });
              setConfirmNew(true);
            }}
          >
            <h3 className="flex items-center text-[17px] font-semibold">
              Make a new repo
              <InfoTip text="Starts an empty project on GitHub under the bot account, then copies it here so agents can build in it." label="Make a new repo" />
            </h3>
            <label className="flex flex-col gap-2">
              <span className="text-[14px] font-semibold">Name</span>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="my-first-site" className={`${field} min-h-11`} maxLength={60} />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-[14px] font-semibold">What is it? (optional)</span>
              <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="My portfolio site" className={`${field} min-h-11`} maxLength={200} />
            </label>
            <button type="submit" className={btn.primary + " mt-auto"} disabled={!!busy}>
              {busy === "create" ? "Making it…" : "Make it"}
            </button>
          </form>
        </div>
      </section>

      <Confirm
        open={confirmNew}
        title="Make a public repo?"
        text={`This makes “${newName.trim()}” on GitHub under the bot account. It's public, so anyone can see the code. Never put passwords or keys in it.`}
        yes="Make it"
        onYes={create}
        onClose={() => setConfirmNew(false)}
      />
    </div>
  );
}

// "Add a file": puts a file (like a CLAUDE.md brief) in the project as a pull request, merged from the Inbox in one click.
function AddFile({ project, want }: { project: string; want: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");

  async function send(f: File | undefined) {
    if (!f) return;
    if (f.size > 5_000_000) return setError("That file is too big. Keep it under 5 MB.");
    setBusy(true);
    setError("");
    setSent("");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
        r.onerror = () => reject(new Error("Couldn't read that file."));
        r.readAsDataURL(f);
      });
      const j = await post<{ file: string }>(`/api/projects/${encodeURIComponent(project)}/files`, { name: f.name, base64 });
      setSent(j.file);
      window.dispatchEvent(new Event("agentbox:changed"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      {want && !sent && (
        <p className="text-[15px] font-semibold text-[#2A3F9E]">
          Add {want} here: press Add a file and pick it from your computer.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={want && !sent ? btn.primary : btn.secondary} onClick={() => input.current?.click()} disabled={busy}>
          {busy ? "Adding it…" : "Add a file"}
        </button>
        <InfoTip label="Add a file" text="Puts a file from your computer (like a CLAUDE.md brief) into this project. It opens a pull request; merge it from the Inbox with one click and every agent can read it." />
      </div>
      <input
        ref={input}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          send(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {sent && (
        <p role="status" className="text-[15px] text-[#1E6B34]">
          <span className="font-semibold">{sent} is ready to add.</span> Merge it from the{" "}
          <Link href="/inbox" className="font-semibold underline">
            Inbox
          </Link>{" "}
          to finish.
        </p>
      )}
      {error && (
        <p role="alert" className="text-[14px] font-semibold text-[#A11B12]">
          {error}
        </p>
      )}
    </div>
  );
}
