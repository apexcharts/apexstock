import { terser } from "rollup-plugin-terser";
import babel from "@rollup/plugin-babel";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";

const production = !process.env.ROLLUP_WATCH;

export default {
  input: "src/ApexStock.js",
  output: [
    {
      file: "dist/apexstock.min.js",
      format: "iife",
      name: "ApexStock",
      sourcemap: !production,
    },
    {
      file: "dist/apexstock.umd.js",
      format: "umd",
      name: "ApexStock",
      sourcemap: !production,
    },
    {
      file: "dist/apexstock.esm.js",
      format: "es",
      sourcemap: !production,
    },
  ],
  plugins: [
    resolve(),

    commonjs(),

    babel({
      babelHelpers: "bundled",
      presets: [
        [
          "@babel/preset-env",
          {
            targets: "> 0.25%, not dead",
            useBuiltIns: "usage",
            corejs: 3,
          },
        ],
      ],
      exclude: "node_modules/**",
    }),

    // Minify in production
    production &&
      terser({
        compress: {
          pure_getters: true,
          unsafe: true,
          unsafe_comps: true,
          warnings: false,
        },
      }),
  ],
};
