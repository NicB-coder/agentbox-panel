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
  type Where = "clone" | "pick" | "create";
  const [error, setError] = useState<{ msg: string; retry?: () => void; where: Where; typo?: boolean } | null>(null);
  const [done, setDone] = useState<{ msg: string; where: Where } | null>(null);
  // What a new project will really be called (the same rule the server uses).
  const slug = newName.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[-.]+|-+$/g, "").slice(0, 60);
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

  async function clone(repo: string, where: Where) {
    if (!repo.trim()) return setError({ msg: "Paste the project's GitHub address first, like github.com/NicB-coder/portfolio.", where, typo: true });
    setBusy("clone");
    setError(null);
    setDone(null);
    try {
      const j = await post<{ name: string }>("/api/projects/clone", { repo });
      setDone({ msg: `${j.name} is ready. It's at the top of this page, and you can pick it when you start a task.`, where });
      setTyped("");
      setRepos((r) => r?.filter((x) => x.name !== repo) ?? r);
      await reload();
    } catch (e) {
      const msg = (e as Error).message;
      setError({ msg, retry: () => clone(repo, where), where, typo: /Paste the whole address|already a project|won't work/.test(msg) });
    } finally {
      setBusy("");
    }
  }

  async function create() {
    setConfirmNew(false);
    setBusy("create");
    setError(null);
    setDone(null);
    try {
      const j = await post<{ name: string }>("/api/projects/create", { name: newName, description: newDesc });
      setDone({ msg: `${j.name} is ready. It's at the top of this page, and you can pick it when you start a task.`, where: "create" });
      setNewName("");
      setNewDesc("");
      await reload();
    } catch (e) {
      const msg = (e as Error).message;
      setError({ msg, retry: create, where: "create", typo: /already/.test(msg) });
    } finally {
      setBusy("");
    }
  }

  const Result = ({ where }: { where: Where }) => (
    <>
      {error?.where === where && <ErrorBox compact message={error.msg} onRetry={error.typo ? undefined : error.retry} noFix={error.typo} where="Projects" />}
      {done?.where === where && (
        <p role="status" className="rounded-[14px] bg-[#E6F4EA] px-4 py-3 text-[15px] font-semibold text-[#1E6B34]">
          {done.msg}
        </p>
      )}
    </>
  );

  return (
    <div>
      <PageTitle title="Projects" sub="A project is one app, game or website. Agents build inside it. Each one is also saved on GitHub, a website that keeps your code safe." />

      <section aria-labelledby="have-h">
        <h2 id="have-h" className="text-[22px] font-bold">
          On this Mac
        </h2>
        {list.length === 0 ? (
          <div className="mt-4">
            <EmptyState icon="folder" title="No projects yet" text="Start a new one below. Give it a name, like my-game, and press Make it." />
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
                  {p.lastActivity ? `Last change ${ago(p.lastActivity)}${p.lastMessage && !/^initial commit$/i.test(p.lastMessage.trim()) ? `: “${p.lastMessage.slice(0, 80)}”` : ""}` : "No changes yet"}
                </p>
                <div>
                  <p className="text-[14px] font-semibold">
                    {p.prs.length ? `${p.prs.length} ${p.prs.length === 1 ? "change" : "changes"} waiting for you to look at` : "No changes waiting for you"}
                  </p>
                  {p.prs.length > 0 && (
                    <ul className="mt-1 flex flex-col">
                      {p.prs.slice(0, 5).map((pr) => (
                        <li key={pr.number}>
                          <a href={`/changes?pr=${encodeURIComponent(pr.url)}`} className="flex min-h-11 items-center gap-2 text-[14px] underline">
                            <span className="truncate">
                              #{pr.number} {pr.title}
                            </span>
                            {pr.draft && <span className="shrink-0 rounded-full bg-soft px-2 text-[12px] font-semibold text-[#4A4F57] no-underline">not finished yet</span>}
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
              if (!slug) return setError({ msg: "Give your new project a name first, like my-game.", where: "create", typo: true });
              setError(null);
              setConfirmNew(true);
            }}
          >
            <h3 className="flex items-center text-[17px] font-semibold">
              Start a new project
              <InfoTip text="Makes a new, empty project for your app, game or site. Agents can start building in it straight away." label="Start a new project" />
            </h3>
            <label className="flex flex-col gap-2">
              <span className="text-[14px] font-semibold">Name</span>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="my-game" className={`${field} min-h-11`} maxLength={60} aria-describedby="new-name-hint" />
            </label>
            <p id="new-name-hint" className="-mt-1 text-[13px] text-muted">
              {slug && slug !== newName.trim() ? `It will be called “${slug}” (small letters and dashes only).` : "Small letters and dashes work best."}
            </p>
            <label className="flex flex-col gap-2">
              <span className="text-[14px] font-semibold">What is it? (optional)</span>
              <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="A game where you dodge falling blocks" className={`${field} min-h-11`} maxLength={200} />
            </label>
            <button type="submit" className={btn.primary + " mt-auto"} disabled={!!busy}>
              {busy === "create" ? "Making it…" : "Make it"}
            </button>
            <Result where="create" />
          </form>

          <form
            className="panel flex flex-col gap-3 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              clone(typed, "clone");
            }}
          >
            <h3 className="flex items-center text-[17px] font-semibold">
              Already on GitHub?
              <InfoTip text="If the project is already saved on GitHub, paste its address and agentbox copies it onto this Mac. The agentbox GitHub account (NicB-coder-bot) needs to be allowed to see it." label="Already on GitHub?" />
            </h3>
            <label className="flex flex-col gap-2">
              <span className="text-[14px] font-semibold">Its GitHub address</span>
              <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="github.com/NicB-coder/portfolio" className={`${field} min-h-11`} />
            </label>
            <button type="submit" className={btn.primary + " mt-auto"} disabled={!!busy || !typed.trim()}>
              {busy === "clone" ? "Copying…" : "Add it"}
            </button>
            <Result where="clone" />
          </form>

          <div className="panel flex flex-col gap-3 p-6">
            <h3 className="flex items-center text-[17px] font-semibold">
              Or pick one from GitHub
              <InfoTip text="Projects the agentbox GitHub account can already see that aren't on this Mac yet." label="Or pick one from GitHub" />
            </h3>
            {repos === null ? (
              <Loading text="Asking GitHub…" />
            ) : repos.length === 0 ? (
              <p className="text-[14px] text-muted">There aren't any others. Every project agentbox can see is already here.</p>
            ) : (
              <>
                <label className="flex flex-col gap-2">
                  <span className="text-[14px] font-semibold">Project</span>
                  <select value={picked} onChange={(e) => setPicked(e.target.value)} className={`${field} min-h-11`}>
                    {repos.map((r) => (
                      <option key={r.name} value={r.name}>
                        {r.name.split("/")[1]}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className={btn.primary + " mt-auto"} disabled={!!busy || !picked} onClick={() => clone(picked, "pick")}>
                  {busy === "clone" ? "Copying…" : "Add it"}
                </button>
              </>
            )}
            <Result where="pick" />
          </div>
        </div>
      </section>

      <Confirm
        open={confirmNew}
        title={`Make “${slug}”?`}
        text="It's saved on GitHub as a public project: other people can look at the code, like most school and hobby projects. That's fine for games and sites. Just never put passwords or private info in it."
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
        <InfoTip label="Add a file" text="Puts a file from your computer (like a list of instructions for agents) into this project. It shows up in your Inbox first: press Merge it there to finish adding it." />
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
