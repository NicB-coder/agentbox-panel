"use client";
import UpdateBox from "./UpdateBox";
import { useState } from "react";
import { ErrorBox, PageTitle, Switch, post } from "./bits";
import { refreshHeader } from "./Header";
import { replayTour } from "./Tour";
import { btn } from "./ui";

export default function SettingsClient({ guard }: { guard: number | null }) {
  const [on, setOn] = useState(guard !== null);
  const [pct, setPct] = useState(guard ?? 90);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");

  async function save(nextOn: boolean, nextPct: number) {
    setError("");
    setSaved("");
    try {
      await post("/api/settings", { usageGuardPct: nextOn ? nextPct : null });
      setSaved("Saved.");
      refreshHeader();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="max-w-[760px]">
      <PageTitle title="Settings" sub="A few switches for the whole app." />
      <section className="panel flex flex-col gap-5 p-6 sm:p-8" aria-labelledby="usage-h">
        <h2 id="usage-h" className="text-[18px] font-semibold">
          Claude usage
        </h2>
        <Switch
          label="Pause new runs when usage gets high"
          hint="Runs that are already going keep going. New ones wait and start by themselves after the reset."
          tip="Saves some usage for you to use yourself. When your Claude usage passes the number below, agents and workflows wait."
          checked={on}
          onChange={(v) => {
            setOn(v);
            save(v, pct);
          }}
        />
        {on && (
          <label className="flex flex-col gap-3">
            <span className="flex items-baseline justify-between text-[15px] font-semibold">
              Wait when usage passes
              <span>{pct}%</span>
            </span>
            <input
              type="range"
              min={50}
              max={99}
              step={1}
              value={pct}
              onChange={(e) => setPct(Number(e.target.value))}
              onPointerUp={() => save(true, pct)}
              onKeyUp={() => save(true, pct)}
              className="h-11 w-full accent-[#15171B]"
            />
          </label>
        )}
        <p className="text-[14px] text-muted" aria-live="polite">
          {saved}
        </p>
        {error && <ErrorBox message={error} onRetry={() => save(on, pct)} where="Settings" />}
      </section>
      <div className="mt-6">
        <UpdateBox />
      </div>
      <section className="panel mt-6 flex flex-col gap-3 p-6 sm:p-8" aria-labelledby="tour-h">
        <h2 id="tour-h" className="text-[18px] font-semibold">
          Welcome tour
        </h2>
        <p className="text-[15px] text-muted">The short tour you saw on your first visit.</p>
        <div>
          <button type="button" className={btn.secondary} onClick={replayTour}>
            Show the welcome tour again
          </button>
        </div>
      </section>
    </div>
  );
}
