import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      // The real core needs the ApexCharts global + a browser; tests mock it.
      apexstock: new URL("./test/__mocks__/apexstock.ts", import.meta.url)
        .pathname,
    },
  },
});
