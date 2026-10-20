import HomeClient from "@/components/HomeClient";
import { homeState } from "@/lib/views";

export const dynamic = "force-dynamic";

export default function Home() {
  return <HomeClient initial={homeState()} />;
}
