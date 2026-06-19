// ESM shim for `react/jsx-runtime` backed by the UMD global. The wrapper's
// built output calls `jsx(type, props, key)`; `React.createElement` reads
// `children` and `key` out of the props/config, so this faithfully reproduces
// the automatic-runtime behaviour with no build step.
const React = window.React;
export const jsx = (type, props, key) =>
  React.createElement(type, key === undefined ? props : { ...props, key });
export const jsxs = jsx;
export const Fragment = React.Fragment;
