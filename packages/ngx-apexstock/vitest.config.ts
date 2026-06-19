import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["test/**/*.test.ts"],
  },
  esbuild: {
    // The Angular component uses TC39-style class-field decorators (@Input,
    // @ViewChild); enable legacy decorator transform for the test runtime.
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        useDefineForClassFields: false,
      },
    },
  },
  resolve: {
    alias: {
      // The real core needs the ApexCharts global + a browser; tests mock it.
      apexstock: new URL("./test/__mocks__/apexstock.ts", import.meta.url)
        .pathname,
    },
  },
});
