// Ambient declarations so `tsc` can resolve non-JS imports and the global
// ApexCharts dependency during declaration emit.

declare module "*.css" {
  const css: string;
  export default css;
}

// The CSS entry is imported via a bare specifier resolved by the Rollup
// css-inline plugin at build time.
declare module "ApexStock.css" {
  const css: string;
  export default css;
}

// ApexCharts is a peer dependency consumed from the global scope.
declare const ApexCharts: any;
