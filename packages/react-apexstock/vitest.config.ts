import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["test/**/*.test.{ts,tsx}"],
    setupFiles: ["./test/setup.ts"],
  },
  resolve: {
    alias: {
      // The real core needs the ApexCharts global + a browser; tests mock it.
      // This alias just lets the import resolve under Vitest.
      apexstock: new URL("./test/__mocks__/apexstock.ts", import.meta.url)
        .pathname,
    },
  },
});
