"use client";
import { useEffect, useId, useRef, useState } from "react";
import { post } from "./bits";
import { Icon, btn } from "./ui";

const STEPS = [
  {
    icon: "sparkle",
    title: "Welcome to agentbox",
    text: "This is where you run AI helpers on this Mac. They're called agents. You tell them what to do in plain words, and they do the work in their own copy of your project.",
  },
  {
    icon: "hammer",
    title: "Agents do the work",
    text: "Each tile on the Agents page is one agent. Click a tile to give it a task, see what it's doing right now, and read what it did before. Nothing it does goes into your main code until you say so.",
  },
  {
    icon: "flow",
    title: "Workflows chain steps together",
    text: "A workflow passes work from one step to the next: research it, build it, review it, test it, then ask you. Start from a ready-made template, or just describe what should happen.",
  },
  {
    icon: "inbox",
    title: "The Inbox and the usage meter",
    text: "Anything that needs you (an OK, a pull request to look at, something that went wrong) shows up in the Inbox. The meter at the top shows how much of your Claude usage is left and when it resets.",
  },
];

export function replayTour() {
  window.dispatchEvent(new Event("agentbox:tour"));
}

export default function Tour({ done }: { done: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [i, setI] = useState(0);
  const [show, setShow] = useState(!done);
  const titleId = useId();
  useEffect(() => {
    const again = () => {
      setI(0);
      setShow(true);
    };
    window.addEventListener("agentbox:tour", again);
    return () => window.removeEventListener("agentbox:tour", again);
  }, []);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (show && !d.open) d.showModal();
    if (!show && d.open) d.close();
  }, [show]);
  function end() {
    setShow(false);
    post("/api/settings", { tourDone: true }).catch(() => {});
  }
  const s = STEPS[i];
  const last = i === STEPS.length - 1;
  return (
    <dialog ref={ref} aria-labelledby={titleId} onClose={end} className="m-auto w-[min(500px,calc(100vw-32px))] rounded-[32px] p-0 backdrop:bg-black/40">
      <div className="flex flex-col gap-4 p-7 sm:p-9">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-soft">
          <Icon name={s.icon} color="#2F4FD8" size={28} />
        </span>
        <p className="text-[14px] font-semibold text-muted">
          {i + 1} of {STEPS.length}
        </p>
        <h2 id={titleId} className="text-[24px] font-bold leading-tight">
          {s.title}
        </h2>
        <p className="text-[16px] leading-relaxed text-muted">{s.text}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" className={btn.primary} onClick={() => (last ? end() : setI(i + 1))} autoFocus>
            {last ? "Let's go" : "Next"}
          </button>
          {i > 0 && (
            <button type="button" className={btn.secondary} onClick={() => setI(i - 1)}>
              Back
            </button>
          )}
          {!last && (
            <button type="button" className="ml-auto min-h-11 px-2 text-[15px] font-semibold text-muted underline" onClick={end}>
              Skip the tour
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
