import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  test: {
    // Default to node; DOM-touching tests opt into jsdom via a
    // `// @vitest-environment jsdom` docblock at the top of the file.
    environment: "node",
    include: ["test/**/*.test.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.js"],
      // Heavy DOM/UI modules are exercised via the smoke test only; the
      // meaningful unit coverage target is the pure indicator/util math.
      thresholds: {
        "src/indicators/Indicators.js": {
          statements: 80,
          branches: 70,
          functions: 90,
          lines: 80,
        },
      },
    },
  },
  resolve: {
    alias: {
      // The Rollup build inlines this via a custom CSS plugin; under Vitest
      // we map the bare specifier to an empty stub so the module graph loads.
      "ApexStock.css": `${rootDir}test/stubs/empty-css.js`,
    },
  },
});
