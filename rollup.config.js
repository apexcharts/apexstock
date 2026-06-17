import terser from "@rollup/plugin-terser";
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
      // CommonJS / Node entry. The `.cjs` extension is required: package.json
      // has `"type": "module"`, so a `.js` file here would be parsed as ESM and
      // its UMD `module.exports` branch would never run — `require("apexstock")`
      // would silently yield `{}`. `.cjs` forces CommonJS resolution while the
      // UMD wrapper keeps it usable as an AMD module or a browser global too.
      file: "dist/apexstock.cjs",
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
      // Add the watch hook to monitor CSS files
      buildStart() {
        // Get all .css files in the src directory
        const findCssFiles = (dir) => {
          const results = [];
          const items = fs.readdirSync(dir);

          for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
              results.push(...findCssFiles(fullPath));
            } else if (item.endsWith(".css")) {
              results.push(fullPath);
            }
          }

          return results;
        };

        try {
          // Add CSS files to the watch list
          const cssFiles = findCssFiles("./src");
          for (const file of cssFiles) {
            this.addWatchFile(file);
          }
        } catch (error) {
          console.error("Error setting up CSS file watching:", error);
        }
      },
      // Emit a standalone dist/apexstock.css (in addition to the inlined CSS)
      // for consumers who manage their own stylesheet pipeline. Runs once,
      // after all output formats are written.
      closeBundle() {
        try {
          const css = fs.readFileSync(
            path.resolve("./src/ApexStock.css"),
            "utf8"
          );
          if (!fs.existsSync("./dist")) {
            fs.mkdirSync("./dist", { recursive: true });
          }
          fs.writeFileSync(path.resolve("./dist/apexstock.css"), css);
        } catch (error) {
          console.error("Error writing standalone CSS:", error);
        }
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
            // Browser targets are read from the "browserslist" field in package.json
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
