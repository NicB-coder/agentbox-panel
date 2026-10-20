"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
          <ul className="mt-4 grid gap-6 md:grid-cols-2">
            {list.map((p) => (
              <li key={p.name} className="panel flex flex-col gap-3 p-6">
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
                          <a href={pr.url} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-2 text-[14px] underline">
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
