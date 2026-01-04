import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.spec.ts"],
    exclude: ["backup/**", "node_modules/**"],
  },
});
