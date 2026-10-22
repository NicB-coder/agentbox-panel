import { NextResponse, type NextRequest } from "next/server";

// Runs before every request.
// 1. Blocks changes coming from other websites (a page Nic visits can't press buttons in his panel, or type in its Terminal).
// 2. A previewed site that links to "/style.css" (an address from the top of the site) gets its own file, not the panel's.

const PANEL = new Set(["", "agents", "api", "_next", "workflows", "inbox", "projects", "settings", "help", "machine", "terminal", "changes", "reports", "connectors", "preview", "favicon.ico", "robots.txt"]);

export function proxy(req: NextRequest) {
  const url = req.nextUrl;
  const top = url.pathname.split("/")[1] ?? "";

  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") {
    // Browsers say where a request comes from. Tailscale may rewrite the Host, so trust "same-origin" first.
    const site = req.headers.get("sec-fetch-site");
    let allowed = site === "same-origin" || site === "none";
    if (!site) {
      // Not a browser (the agents' safety hook, curl) or a very old one: compare the origin if there is one.
      const origin = req.headers.get("origin");
      const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
      try {
        allowed = !origin || new URL(origin).host === host;
      } catch {
        allowed = false;
      }
    }
    if (!allowed) return NextResponse.json({ error: "Not allowed from another website." }, { status: 403 });
  }

  if (!PANEL.has(top)) {
    const ref = req.headers.get("referer");
    const m = ref?.match(/\/preview\/([^/]+)\/([^/]+)\//);
    if (m) return NextResponse.rewrite(new URL(`/preview/${m[1]}/${m[2]}${url.pathname}${url.search}`, req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
