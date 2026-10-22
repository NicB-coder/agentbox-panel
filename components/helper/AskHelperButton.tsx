"use client";
import { btn } from "../ui";
import { askHelper } from "./helperStore";

// "Ask the Helper" from a page (e.g. Help): opens the bubble's panel ready to type.
export default function AskHelperButton({ text = "", label = "Ask the Helper" }: { text?: string; label?: string }) {
  return (
    <button type="button" className={btn.link + " mt-auto self-start"} onClick={() => askHelper(text, false)}>
      {label}
    </button>
  );
}
