import type { Metadata, Viewport } from "next";
import { Instrument_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { listAgents } from "@/lib/db";
import OnlineDot from "@/components/OnlineDot";
import NewTaskButton from "@/components/NewTaskButton";

const instrument = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-instrument",
});

export const metadata: Metadata = {
  title: "agentbox",
  description: "Control the AI agents running on agentbox.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const agents = listAgents()
    .filter((a) => a.kind === "claude" && a.enabled)
    .map((a) => ({ id: a.id, name: a.name, mode: a.mode }));
  return (
    <html lang="en" className={instrument.variable}>
      <body className="min-h-screen bg-white font-sans text-ink">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3">
          Skip to content
        </a>
        <header className="h-16 border-b border-line">
          <div className="mx-auto flex h-full max-w-[1112px] items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex min-h-11 items-center text-[20px] font-bold tracking-tight">
                agentbox
              </Link>
              <OnlineDot />
            </div>
            <NewTaskButton agents={agents} />
          </div>
        </header>
        <main id="main" className="mx-auto max-w-[1112px] px-4 pb-24">
          {children}
        </main>
      </body>
    </html>
  );
}
