import TerminalClient from "@/components/TerminalClient";

export const dynamic = "force-dynamic";

export default async function TerminalPage({ searchParams }: { searchParams: Promise<{ cmd?: string }> }) {
  const { cmd } = await searchParams;
  return <TerminalClient cmd={cmd ?? ""} />;
}
