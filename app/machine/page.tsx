import MachineClient from "@/components/MachineClient";
import { machineInfo } from "@/lib/machine";

export const dynamic = "force-dynamic";

export default async function MachinePage() {
  return <MachineClient initial={await machineInfo(true)} />;
}
