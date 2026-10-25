"use client";
import { useEffect, useId, useRef, useState, type MutableRefObject } from "react";
import type { BriefRef } from "@/lib/types";
import { briefLabel } from "@/lib/wf";
import { InfoTip, post } from "./bits";
import { Icon, btn } from "./ui";

type ProjectBrief = { name: string; lines: number; text: string };

// "Attach a brief (optional)": upload or drag a .md file, or pick one from the project. Shown as a chip with View and Remove.
// Also says when the project already has its own brief (a CLAUDE.md at the top).
export default function BriefPicker({
  project, value, onChange, disabled, openRef, tip,
}: {
  project: string;
  value: BriefRef | null;
  onChange: (b: BriefRef | null) => void;
  disabled?: boolean;
  openRef?: MutableRefObject<(() => void) | null>; // lets an "Attach it" button elsewhere open the file chooser
  tip?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const headId = useId();
  const [own, setOwn] = useState<ProjectBrief | null>(null);
  const [pick, setPick] = useState<null | { file: string }[]>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<null | { title: string; text: string | null }>(null);

  useEffect(() => {
    setOwn(null);
    setPick(null);
    if (!project) return;
    let on = true;
    fetch(`/api/projects/${encodeURIComponent(project)}/briefs?root=1`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { brief: null }))
      .then((j: { brief: ProjectBrief | null }) => on && setOwn(j.brief))
      .catch(() => {});
    return () => {
      on = false;
    };
  }, [project]);

  useEffect(() => {
    if (!openRef) return;
    openRef.current = () => {
      fileRef.current?.closest("section")?.scrollIntoView({ block: "center", behavior: "smooth" });
      fileRef.current?.click();
    };
    return () => {
      openRef.current = null;
    };
  }, [openRef]);

  async function attach(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      onChange(await post<BriefRef>("/api/briefs", body));
      setPick(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function readFile(f: File | undefined) {
    if (!f) return;
    if (!/\.(md|markdown|txt)$/i.test(f.name)) return setError("Pick a Markdown (.md) or text (.txt) file.");
    if (f.size > 400_000) return setError("That file is too big. Keep a brief under about 400 KB.");
    await attach({ name: f.name, text: await f.text() });
  }

  async function listFiles() {
    setError("");
    try {
      const j = await post<{ files: { file: string }[] }>(`/api/projects/${encodeURIComponent(project)}/briefs`, {}, "GET");
      setPick(j.files);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function viewAttached() {
    if (!value) return;
    setView({ title: value.name, text: null });
    try {
      const j = await post<{ text: string }>(`/api/briefs/${value.hash}`, {}, "GET");
      setView({ title: value.name, text: j.text });
    } catch (e) {
      setView({ title: value.name, text: (e as Error).message });
    }
  }

  return (
    <section className="flex flex-col gap-2" aria-labelledby={headId}>
      <p id={headId} className="flex items-center text-[15px] font-semibold">
        Attach a brief (optional)
        <InfoTip
          label="Attach a brief"
          text={tip ?? "Optional. A text file with longer instructions. The agent reads it before every run, so it always knows the details."}
        />
      </p>
      <p className="-mt-1 text-[14px] text-muted">A brief is a text file with longer instructions, like a list of everything your game must have. Skip this if your goal says it all.</p>

      {own && (
        <p className="flex flex-wrap items-center gap-x-2 text-[15px] text-[#1E6B34]">
          <span className="font-semibold">This project already has a brief ✓</span>
          <span className="text-muted">(agents read it by themselves)</span>
          <button type="button" className={btn.link} onClick={() => setView({ title: `${own.name} in ${project}`, text: own.text })}>
            View
          </button>
        </p>
      )}

      {value ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full bg-soft pl-4 pr-2 text-[15px] font-semibold">
            <Icon name="book" color="#15171B" size={18} />
            <span className="truncate">Brief: {briefLabel(value)}</span>
          </span>
          <button type="button" className={btn.link} onClick={viewAttached}>
            View
          </button>
          <button type="button" className={btn.link} onClick={() => onChange(null)} disabled={disabled}>
            Remove
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            if (disabled) return;
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            if (!disabled) readFile(e.dataTransfer.files?.[0]);
          }}
          className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[14px] border-2 border-dashed px-4 py-2 text-[15px] text-muted ${over ? "border-ink bg-soft" : "border-[#B9BEC6]"}`}
        >
          <span>{busy ? "Attaching it…" : "Drag a text file (.md or .txt) here, or"}</span>
          <button type="button" className={btn.link} onClick={() => fileRef.current?.click()} disabled={disabled || busy}>
            Upload a file
          </button>
          {project && (
            <>
              <span aria-hidden="true">·</span>
              <button type="button" className={btn.link} onClick={listFiles} disabled={disabled || busy} aria-expanded={!!pick}>
                Pick a file from the project
              </button>
            </>
          )}
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".md,.markdown,.txt,text/markdown,text/plain"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          readFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {pick && !value && (
        <div className="rounded-[14px] border border-line p-3">
          {pick.length === 0 ? (
            <p className="text-[14px] text-muted">There are no .md or .txt files in {project}. Upload one instead.</p>
          ) : (
            <ul className="flex max-h-56 flex-col overflow-auto" aria-label={`Files in ${project}`}>
              {pick.map((f) => (
                <li key={f.file}>
                  <button type="button" className="flex min-h-11 w-full items-center rounded-[10px] px-3 text-left text-[14px] hover:bg-soft" onClick={() => attach({ project, file: f.file })} disabled={busy}>
                    {f.file}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className={btn.link} onClick={() => setPick(null)}>
            Cancel
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-[14px] font-semibold text-[#A11B12]">
          {error}
        </p>
      )}
      <TextViewer view={view} onClose={() => setView(null)} />
    </section>
  );
}

// A brief, read-only, in a window of its own.
export function TextViewer({ view, onClose }: { view: null | { title: string; text: string | null }; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (view && !d.open) d.showModal();
    if (!view && d.open) d.close();
  }, [view]);
  return (
    <dialog ref={ref} aria-labelledby={titleId} onClose={onClose} className="m-auto w-[min(760px,calc(100vw-24px))] rounded-[24px] p-0 backdrop:bg-black/30">
      <div className="flex max-h-[calc(100dvh-48px)] flex-col gap-4 p-5 sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="min-w-0 truncate text-[20px] font-bold">
            {view?.title}
          </h2>
          <button type="button" className={btn.secondary} onClick={onClose}>
            Close
          </button>
        </div>
        <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-[14px] bg-soft p-4 font-sans text-[14px] leading-relaxed">{view?.text ?? "Loading…"}</pre>
      </div>
    </dialog>
  );
}

export type MissingInfo = { file: string; project: string; message: string };
export const missingOf = (e: unknown): MissingInfo | null => ((e as { data?: { missing?: MissingInfo } })?.data?.missing ?? null);

// "I can't find CLAUDE.md in lookout. Attach it here or add it to the project." Shown instead of starting the run.
export function MissingFileBox({ missing, onAttach, onClose }: { missing: MissingInfo; onAttach?: () => void; onClose?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "center", behavior: "smooth" }); // on a phone it may be off screen
  }, [missing]);
  return (
    <div ref={ref} role="alert" className="flex flex-col gap-3 rounded-[18px] bg-[#FDF0DC] p-5">
      <p className="text-[16px] font-semibold text-[#8A4600]">Nothing started yet</p>
      <p className="text-[16px] leading-relaxed">{missing.message}</p>
      <div className="flex flex-wrap gap-3">
        {onAttach && (
          <button type="button" className={btn.primary} onClick={onAttach}>
            Attach it
          </button>
        )}
        <a href={`/projects?add=${encodeURIComponent(missing.project)}&file=${encodeURIComponent(missing.file)}`} className={btn.secondary}>
          Add to project
        </a>
        {onClose && (
          <button type="button" className={btn.link} onClick={onClose}>
            Close
          </button>
        )}
      </div>
    </div>
  );
}
