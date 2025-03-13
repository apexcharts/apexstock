import { terser } from "rollup-plugin-terser";
import babel from "@rollup/plugin-babel";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import fs from "fs";
import path from "path";

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
    // Custom plugin to handle CSS imports
    {
      name: "css-inline",
      resolveId(source) {
        // Check if the import is for a CSS file
        if (source.endsWith(".css") || path.extname(source) === ".css") {
          // Return the source to mark it as "resolved"
          return source;
        }
        return null; // Let Rollup handle other imports
      },
      load(id) {
        // Only process CSS files
        if (id.endsWith(".css") || path.extname(id) === ".css") {
          try {
            // Try to resolve the path
            let cssPath = id;

            // If it's not an absolute path, try to find it
            if (!path.isAbsolute(id)) {
              // Look in src directory
              const srcPath = path.resolve("./src", id);
              if (fs.existsSync(srcPath)) {
                cssPath = srcPath;
              } else {
                // Try current directory
                const curPath = path.resolve("./", id);
                if (fs.existsSync(curPath)) {
                  cssPath = curPath;
                }
              }
            }

            // Read the CSS file
            const css = fs.readFileSync(cssPath, "utf8");

            // Return the CSS as a JavaScript string
            return `
              // CSS Module: ${id}
              const css = ${JSON.stringify(css)};
              
              // Function to inject CSS
              function injectCSS() {
                if (typeof document !== 'undefined') {
                  const style = document.createElement('style');
                  style.textContent = css;
                  document.head.appendChild(style);
                }
              }
              
              // Auto-inject in browser environments
              injectCSS();
              
              // Export the CSS string for manual usage
              export default css;
            `;
          } catch (error) {
            console.error(`Error processing CSS file ${id}:`, error);
            return `export default null; // Error loading CSS`;
          }
        }
        return null; // Let Rollup handle other files
      },
    },

    resolve({
      extensions: [".js", ".jsx", ".css"],
    }),

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
