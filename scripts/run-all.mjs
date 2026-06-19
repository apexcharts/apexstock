#!/usr/bin/env node
/**
 * Run one npm task across the core and every framework-wrapper package, in
 * dependency order (core first, since the wrappers resolve its `dist/types`).
 *
 *   node scripts/run-all.mjs <task>
 *
 * <task> is one of: install | build | typecheck | test (anything else is passed
 * through as `npm run <task>`). Every target is attempted even if an earlier one
 * fails; a summary is printed and the process exits non-zero if any failed.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Order matters: the core must build before the wrappers, which type-check and
// bundle against its emitted `dist/types`.
const targets = [
  { name: "apexstock (core)", dir: root },
  { name: "react-apexstock", dir: join(root, "packages/react-apexstock") },
  { name: "vue-apexstock", dir: join(root, "packages/vue-apexstock") },
  { name: "ngx-apexstock", dir: join(root, "packages/ngx-apexstock") },
];

const task = process.argv[2];
if (!task) {
  console.error("usage: node scripts/run-all.mjs <install|build|typecheck|test>");
  process.exit(2);
}

// Map the task to an npm argv. `install` is a direct npm command; everything
// else runs the package's own script of that name.
const argvFor = (t) => (t === "install" ? ["install"] : ["run", t]);

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const results = [];

for (const { name, dir } of targets) {
  console.log(`\n→ ${name}: npm ${argvFor(task).join(" ")}`);
  const { status } = spawnSync(npm, argvFor(task), {
    cwd: dir,
    stdio: "inherit",
  });
  results.push({ name, ok: status === 0 });
}

console.log("\n── summary ──");
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}`);

process.exit(results.every((r) => r.ok) ? 0 : 1);
