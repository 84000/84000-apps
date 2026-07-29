/* eslint-disable @typescript-eslint/no-explicit-any */
declare module '*.svg' {
  const content: any;
  export const ReactComponent: any;
  export default content;
}

// Side-effect stylesheet imports, e.g. `import 'nextra-theme-docs/style.css'`.
// Next handles these at build time, but with `moduleResolution: bundler` tsc
// still wants a declaration for the package subpath.
declare module '*.css';
