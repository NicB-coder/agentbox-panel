import { getReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

// The Report page printed to PDF by a real browser on this Mac (header, buttons and the Helper are left out).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = getReport(Number((await params).id));
  if (!r) return new Response("Not found", { status: 404 });
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${process.env.PORT || 3000}/reports/${r.id}`, { waitUntil: "load", timeout: 30_000 });
    await page.emulateMedia({ media: "print" });
    const pdf = await page.pdf({ format: "Letter", margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" }, printBackground: true });
    const name = r.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "report";
    return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${name}.pdf"` } });
  } catch {
    return new Response("Couldn't make the PDF this time. Try again in a moment.", { status: 500 });
  } finally {
    await browser.close();
  }
}
