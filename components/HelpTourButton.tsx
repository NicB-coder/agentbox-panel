"use client";
import { replayTour } from "./Tour";
import { btn } from "./ui";

export default function HelpTourButton() {
  return (
    <button type="button" className={btn.secondary} onClick={replayTour}>
      Show the welcome tour again
    </button>
  );
}
