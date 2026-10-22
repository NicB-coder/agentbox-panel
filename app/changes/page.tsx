import ChangesClient from "@/components/ChangesClient";

export const dynamic = "force-dynamic";

export default async function Changes({ searchParams }: { searchParams: Promise<{ pr?: string }> }) {
  const { pr = "" } = await searchParams;
  return <ChangesClient pr={pr} />;
}
