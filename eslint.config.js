import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "examples/**",
      ".github/**",
      // Framework wrappers are independent packages with their own toolchains
      // (tsup / ng-packagr / vitest) and TypeScript sources; the root config
      // lints the core only.
      "packages/**",
    ],
  },

  js.configs.recommended,

  // Library source — browser runtime, ApexCharts available as a global.
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ApexCharts: "readonly",
      },
    },
    rules: {
      // Start permissive: warn on the existing inconsistencies rather than block.
      "no-unused-vars": "warn",
      "no-empty": "warn",
      "no-fallthrough": "warn",
      "no-prototype-builtins": "off",
      // 46 existing sites; scope-leak style only, not a footgun. Tighten to
      // "error" during the Phase 3 indicator/switch refactor.
      "no-case-declarations": "warn",
      // Real footguns stay as errors.
      "no-undef": "error",
      eqeqeq: ["error", "smart"],
      "no-unsafe-optional-chaining": "error",
    },
  },

  // Build / tooling configs and repo scripts run in Node.
  {
    files: ["**/*.config.js", "rollup.config.js", "scripts/**/*.{js,mjs}"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.node },
    },
  },

  // Tests run under Vitest (node/jsdom) and import their globals explicitly.
  {
    files: ["test/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      "no-unused-vars": "warn",
    },
  },

  // Must come last: turns off rules that conflict with Prettier formatting.
  prettier,
];
