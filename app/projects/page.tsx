import ProjectsClient from "@/components/ProjectsClient";
import { projectInfos } from "@/lib/projectsAdmin";

export const dynamic = "force-dynamic";

export default async function Projects() {
  return <ProjectsClient initial={await projectInfos()} />;
}
