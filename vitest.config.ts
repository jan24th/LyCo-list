import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["apps/*/vitest.config.ts", "packages/*/vitest.config.ts"],
    coverage: {
      provider: "v8",
      all: false,
      reporter: ["text", "json", "html"],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
      exclude: [
        "node_modules/**",
        ".sst/**",
        "dist/**",
        "**/*.d.ts",
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/vitest.config.ts",
        "**/test-setup.ts",
        "**/vite.config.ts",
        "**/sst.config.ts",
        "**/main.tsx",
        "**/src/components/ui/**",
      ],
    },
  },
});
