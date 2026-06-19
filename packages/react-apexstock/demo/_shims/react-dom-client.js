// ESM shim for `react-dom/client` backed by the UMD global `ReactDOM`.
const ReactDOM = window.ReactDOM;
export const createRoot = ReactDOM.createRoot;
export default ReactDOM;
