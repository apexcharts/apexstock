import { defineConfig } from "vite";
import angular from "@analogjs/vite-plugin-angular";

// The Angular plugin runs the compiler (and the linker over the partial-Ivy
// `ngx-apexstock` build), so the published package is exercised exactly as a
// consumer's AOT build would exercise it.
export default defineConfig({
  plugins: [angular()],
  server: { port: 5199, open: false },
  // The core reads a global `ApexCharts`; pre-bundle it so the dep graph is happy.
  optimizeDeps: { include: ["apexcharts"] },
});
