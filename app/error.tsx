"use client";
import { ErrorBox } from "@/components/bits";

// Any page that breaks shows this instead of a blank screen.
export default function PageError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-[640px] py-16">
      <h1 className="text-[28px] font-bold">This page ran into a problem</h1>
      <p className="mt-2 text-[16px] text-muted">Your agents and workflows keep running. Try again, or ask Claude to look into it.</p>
      <div className="mt-6">
        <ErrorBox message={`The page couldn't load: ${error.message || "an unexpected error"}`} onRetry={reset} />
      </div>
    </div>
  );
}
