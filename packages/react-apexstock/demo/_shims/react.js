// ESM shim: re-export the global `React` (loaded via the UMD <script> tag) so
// the built wrapper's `import ... from "react"` resolves with no bundler and no
// network. The demo and the wrapper share this one module identity, so hooks
// work correctly.
const React = window.React;
export default React;
export const forwardRef = React.forwardRef;
export const useRef = React.useRef;
export const useImperativeHandle = React.useImperativeHandle;
export const useEffect = React.useEffect;
export const useState = React.useState;
export const createElement = React.createElement;
