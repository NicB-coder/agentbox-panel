import ConnectorsClient from "@/components/ConnectorsClient";
import { connectorStatus } from "@/lib/connectorStatus";

export const dynamic = "force-dynamic";

export default async function ConnectorsPage() {
  return <ConnectorsClient initial={await connectorStatus()} />;
}
