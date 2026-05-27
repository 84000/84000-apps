// Plain (non-module) CSS side-effect imports, e.g. `import './global.css'`.
// nx's cssmodule typings only cover `*.module.css`; under bundler module
// resolution TS requires an explicit declaration for bare side-effect imports.
declare module '*.css';
