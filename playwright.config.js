import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright e2e + visual-regression config for ApexStock.
 *
 * The example/fixture pages load both `apexstock` and the sibling
 * `apexcharts-js` build via root-absolute paths (`/apexstock/...`,
 * `/apexcharts-js/...`), so the static server's root is the PARENT directory
 * (`Work/apexcharts`). The fixture lives at
 * `/apexstock/test/e2e/fixtures/chart.html`.
 *
 * Visual baselines (the committed `*-snapshots/*.png`) are generated on the
 * maintainer's machine; rendering varies slightly across OS/font stacks, so a
 * small per-pixel tolerance is allowed. Regenerate intentionally with
 * `yarn test:e2e:update` and review the diff — do not blindly accept churn.
 */
const PORT = 5567;

export default defineConfig({
  testDir: "./test/e2e",
  testMatch: "**/*.spec.js",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
  },
  expect: {
    toHaveScreenshot: {
      // Tolerate minor sub-pixel/font-AA differences across machines.
      maxDiffPixelRatio: 0.02,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Serve the parent dir so /apexstock and /apexcharts-js both resolve.
    command: `python3 -m http.server ${PORT} --directory ..`,
    url: `http://127.0.0.1:${PORT}/apexstock/test/e2e/fixtures/chart.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
