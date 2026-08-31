import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright e2e + visual-regression config for ApexStock.
 *
 * The static server's root is the REPO root, so fixtures load the built
 * `apexstock` from `/dist/` and its ApexCharts peer from
 * `/node_modules/apexcharts/dist/`. ApexCharts is a pinned devDependency: the
 * suite therefore exercises the build a user installs, and a clone plus
 * `yarn install` is everything it needs. (It used to be served from a sibling
 * `apexcharts-js` checkout, which meant these tests silently validated
 * whatever happened to be in that directory.)
 *
 * Visual baselines (the committed `*-snapshots/*.png`) are generated on the
 * maintainer's machine; rendering varies slightly across OS/font stacks, so a
 * small per-pixel tolerance is allowed. Regenerate intentionally with
 * `yarn test:e2e:update` and review the diff, do not blindly accept churn.
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
    // Repo root: /dist and /node_modules both resolve from here.
    command: `python3 -m http.server ${PORT}`,
    url: `http://127.0.0.1:${PORT}/test/e2e/fixtures/chart.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
