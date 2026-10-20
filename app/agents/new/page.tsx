import AgentEditor from "@/components/AgentEditor";
import { listProjects } from "@/lib/projects";
import type { AgentInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function NewAgent() {
  const projects = listProjects();
  const blank: AgentInput = {
    name: "",
    color: "#2F4FD8",
    icon: "sparkle",
    prompt: "",
    project: projects[0] ?? "",
    scheduleKind: "manual",
    scheduleDays: [1, 2, 3, 4, 5],
    scheduleTime: "02:00",
    allowed: "suggest",
    mode: "auto",
    maxMinutes: 30,
    model: "sonnet",
    notify: ["finished", "needs_ok", "problems"],
    enabled: true,
  };
  return <AgentEditor id={null} initial={blank} projects={projects} />;
}
