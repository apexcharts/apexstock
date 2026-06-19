import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // The core library and Vue are peer dependencies — never bundle them.
  external: ["apexstock", "vue"],
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
});
