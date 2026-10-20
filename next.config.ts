import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "playwright", "playwright-core"],
  poweredByHeader: false,
  // A separate build folder for a second dev copy, so it never touches the always-on service's build.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
