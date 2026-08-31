#!/usr/bin/env node
/**
 * Print the GitHub release body for one published package.
 *
 * Run by `publish.yml` right after a successful `npm publish`, and by hand when
 * backfilling a release. Same code path either way, so what CI posts is what
 * you can preview locally:
 *
 *   node scripts/release-notes.mjs apexstock 0.5.0
 *   node scripts/release-notes.mjs react-apexstock 0.2.2
 *
 * The core's body is its `CHANGELOG.md` section for that version, verbatim, so
 * the release and the changelog cannot drift. The wrappers have no changelog of
 * their own, so they get a short stub pointing at the core's. Either way the
 * body opens with links to the full changelog and the exact npm version, which
 * is the shape the other ApexCharts repos use.
 *
 * An optional lead paragraph goes in `.github/release-notes/<pkg>@<version>.md`
 * and is inserted above the changelog. That is where the editorial framing
 * belongs (what this release is *about*, what breaks, the upgrade line). It
 * lives in git next to the release commit rather than being typed into the
 * GitHub UI afterwards, so the notes CI posts are complete on the first try and
 * reviewable in the diff.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const REPO = "https://github.com/apexcharts/apexstock";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The `## [version]` section of CHANGELOG.md, without its heading.
 *
 * Anchored on the heading rather than a line offset so reordering the file
 * cannot silently shift which notes get published. Returns null when the
 * version has no section, which is the case for every wrapper.
 *
 * @param {string} version
 * @returns {string | null}
 */
function changelogSection(version) {
  const md = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8");
  const escaped = version.replace(/\./g, "\\.");
  const re = new RegExp(
    `^## \\[${escaped}\\][^\\n]*\\n([\\s\\S]*?)(?=^## \\[|\\Z)`,
    "m"
  );
  const m = md.match(re);
  return m ? m[1].trim() : null;
}

/**
 * The hand-written lead for this release, if one was committed.
 *
 * @param {string} pkg
 * @param {string} version
 * @returns {string | null}
 */
function lead(pkg, version) {
  try {
    const text = readFileSync(
      join(ROOT, ".github", "release-notes", `${pkg}@${version}.md`),
      "utf8"
    );
    return text.trim() || null;
  } catch {
    return null; // optional by design
  }
}

/**
 * @param {string} pkg
 * @param {string} version
 * @returns {string}
 */
function body(pkg, version) {
  const npm = `https://www.npmjs.com/package/${pkg}/v/${version}`;
  const changelog = `${REPO}/blob/main/CHANGELOG.md`;
  const header = `Full changelog: [CHANGELOG.md](${changelog}) · npm: ${npm}`;

  const intro = lead(pkg, version);
  const parts = [header];
  if (intro) parts.push(intro);

  if (pkg === "apexstock") {
    const section = changelogSection(version);
    if (!section) {
      throw new Error(
        `CHANGELOG.md has no "## [${version}]" section. Add it before releasing,` +
          ` or the release notes would ship empty.`
      );
    }
    parts.push(section);
    return parts.join("\n\n") + "\n";
  }

  if (!intro) {
    const framework = { "react-apexstock": "React", "vue-apexstock": "Vue 3" }[
      pkg
    ] ?? "Angular";
    parts.push(
      `The ${framework} wrapper for ApexStock, published with provenance.\n\n` +
        `Wrapper releases track the core: see the [CHANGELOG](${changelog}) for` +
        ` what changed, and \`packages/${pkg}/README.md\` for the component API.`
    );
  }
  return parts.join("\n\n") + "\n";
}

const [pkg, version] = process.argv.slice(2);
if (!pkg || !version) {
  console.error("usage: release-notes.mjs <package> <version>");
  process.exit(2);
}
process.stdout.write(body(pkg, version));
