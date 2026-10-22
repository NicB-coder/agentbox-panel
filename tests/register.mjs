// Lets `node --test` load the app's TypeScript straight from lib/ (Node strips the types itself):
// "@/lib/x" and "./x" find x.ts. No extra packages, no build step.
import fs from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

registerHooks({
  resolve(spec, ctx, next) {
    let file = null;
    if (spec.startsWith("@/")) file = path.join(root, spec.slice(2));
    else if ((spec.startsWith("./") || spec.startsWith("../")) && ctx.parentURL?.startsWith("file:")) file = path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), spec);
    if (file && !path.extname(file)) {
      for (const ext of [".ts", ".tsx", "/index.ts"]) if (fs.existsSync(file + ext)) return next(pathToFileURL(file + ext).href, ctx);
    }
    if (file && spec.startsWith("@/")) return next(pathToFileURL(file).href, ctx);
    return next(spec, ctx);
  },
  load(url, ctx, next) {
    if (url.startsWith(pathToFileURL(root).href) && url.endsWith(".ts")) return next(url, { ...ctx, format: "module-typescript" });
    return next(url, ctx);
  },
});
