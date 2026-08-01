import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@platform": path.resolve(__dirname, "apps/platform/src"),
      "@storefront": path.resolve(__dirname, "apps/storefront/src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: { reporter: ["text", "html"] },
  },
});

