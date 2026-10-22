import { redirect } from "next/navigation";

// v3: there's no blank agent editor any more. Every task becomes its own agent, so this opens Start a task.
export default function NewAgent() {
  redirect("/?new=1");
}
