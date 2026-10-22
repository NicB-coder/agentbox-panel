import Link from "next/link";
import { notFound } from "next/navigation";
import { getAgent } from "@/lib/db";
import { renderMarkdown } from "@/lib/markdown";
import { getReport } from "@/lib/reports";
import { BackLink } from "@/components/bits";
import { Icon, btn } from "@/components/ui";

export const dynamic = "force-dynamic";

// A research report: the short answer first, then sections, then every source as a link.
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const r = Number.isInteger(id) ? getReport(id) : null;
  if (!r) notFound();
  const agent = getAgent(r.agentId);
  const html = renderMarkdown(r.markdown.replace(/^#\s+.*\n/, ""));
  return (
    <div className="pt-8 sm:pt-10">
      <div className="no-print">
        <BackLink href={agent ? `/agents/${agent.id}` : "/inbox"}>{agent?.name ?? "Inbox"}</BackLink>
      </div>
      <header className="mt-4 max-w-[760px]">
        <p className="text-[14px] font-semibold text-[#7048C8]">Research report · {new Date(r.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
        <h1 className="mt-1 text-[30px] font-bold leading-tight tracking-tight sm:text-[36px]">{r.title}</h1>
        <p className="mt-3 text-[16px] text-muted">
          <span className="font-semibold text-ink">The question:</span> {r.question.length > 400 ? `${r.question.slice(0, 400)}…` : r.question}
        </p>
        {r.reviewed && <p className="mt-2 text-[15px] font-semibold text-[#1E6B34]">{r.reviewed.replace("Reviewed ✓", "Checked against its sources ✓")}</p>}
        <div className="no-print mt-5 flex flex-wrap gap-3">
          <a href={`/api/reports/${r.id}/pdf`} className={btn.primary}>
            Download PDF
          </a>
          <a href={`/api/reports/${r.id}/md`} className={btn.secondary}>
            Download Markdown
          </a>
          {r.prUrl && (
            <Link href={`/changes?pr=${encodeURIComponent(r.prUrl)}`} className={btn.secondary}>
              <Icon name="folder" color="#15171B" size={16} /> Saved in {r.project}
            </Link>
          )}
        </div>
      </header>
      <article className="prose-report mt-8 max-w-[760px]" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
