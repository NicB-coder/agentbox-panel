import SettingsClient from "@/components/SettingsClient";
import { getSetting } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function Settings() {
  return <SettingsClient guard={getSetting<number | null>("usageGuardPct", null)} />;
}
