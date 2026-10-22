import type { Metadata, Viewport } from "next";
import { Instrument_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { headerState } from "@/lib/control";
import { connectorStatusNow } from "@/lib/connectorStatus";
import { listProjects } from "@/lib/projects";
import Header from "@/components/Header";
import HelperBubble from "@/components/helper/HelperBubble";

const instrument = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-instrument",
});

export const metadata: Metadata = {
  title: "agentbox",
  description: "Control the AI agents running on agentbox.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff", viewportFit: "cover" };

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={instrument.variable}>
      <body className="min-h-screen bg-white font-sans text-ink">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3">
          Skip to content
        </a>
        <Header initial={headerState()} projects={listProjects()} connectors={connectorStatusNow().map((c) => ({ id: c.id, name: c.name, connected: c.state === "connected", risky: false }))} />
        <main id="main" className="mx-auto max-w-[1112px] px-4 pb-16">
          {children}
        </main>
        <footer className="mx-auto max-w-[1112px] px-4 pb-28 lg:pb-10">
          <nav aria-label="More" className="flex flex-wrap gap-x-2 border-t border-line pt-4 text-[14px] text-muted">
            <Link href="/connectors" className="inline-flex min-h-11 items-center px-2 font-medium hover:text-ink">
              Connectors
            </Link>
            <Link href="/machine" className="inline-flex min-h-11 items-center px-2 font-medium hover:text-ink">
              Machine
            </Link>
            <Link href="/terminal" className="inline-flex min-h-11 items-center px-2 font-medium hover:text-ink">
              Terminal
            </Link>
            <Link href="/settings" className="inline-flex min-h-11 items-center px-2 font-medium hover:text-ink">
              Settings
            </Link>
            <Link href="/help" className="inline-flex min-h-11 items-center px-2 font-medium hover:text-ink">
              Help
            </Link>
          </nav>
        </footer>
        <HelperBubble />
      </body>
    </html>
  );
}
