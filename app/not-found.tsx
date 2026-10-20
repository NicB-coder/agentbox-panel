import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <h1 className="text-[28px] font-bold">That page isn't here</h1>
      <p className="mt-2 text-[17px] text-muted">It may have been deleted.</p>
      <Link href="/" className="mt-6 inline-flex min-h-11 items-center rounded-[14px] bg-ink px-5 font-semibold text-white">
        Back to all agents
      </Link>
    </div>
  );
}
