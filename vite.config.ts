// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

import path from "node:path";

// react-email renders via htmlparser2 -> entities. Package managers can install
// a nested entities v6/v7 copy that removed ./lib/decode.js, which breaks SSR.
// Force every import to the hoisted v4.5.0 copy.
const entitiesDir = path.resolve(process.cwd(), "node_modules/entities");

const env = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");
const lovableAppUrl = (
  env.VITE_LOVABLE_APP_URL?.trim() || "https://tworz-biznes-sercem.lovable.app"
).replace(/\/$/, "");
const lovableProxy =
  lovableAppUrl.includes(".lovable.app")
    ? {
        "/~oauth": {
          target: lovableAppUrl,
          changeOrigin: true,
          secure: true,
        },
      }
    : undefined;

export default defineConfig({
  vite: {
    resolve: {
      alias: {
        "entities/lib/decode.js": path.join(entitiesDir, "lib/decode.js"),
        "entities/lib/encode.js": path.join(entitiesDir, "lib/encode.js"),
        entities: entitiesDir,
      },
    },
    server: lovableProxy ? { proxy: lovableProxy } : undefined,
  },
});
