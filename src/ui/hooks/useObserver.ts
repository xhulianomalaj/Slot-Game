// Re-exports from mobx-react-lite. We call it `observer` as a convention; if
// the state library ever changes, this file is the one place to adjust.
//
// mobx-react-lite targets React's API, which Preact serves via @preact/preset-vite's
// compat aliases — no ceremony needed at the call site.
export { observer } from 'mobx-react-lite';
