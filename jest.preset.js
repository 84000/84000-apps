const nxPreset = require('@nx/jest/preset').default;

// Dependencies that reach Jest as ESM, which it cannot require as-is. Naming a
// package here also covers the copies npm installs under its own
// `node_modules`, which are ESM just as often -- `sanitize-html` is itself CJS
// and is here only for the parser beneath it.
//
// Shared rather than per project because `data-access` is in almost every
// project's graph, so four of them load the sanitizer transitively and the
// fifth would meet a parse error with nothing pointing at the fix.
const esmDeps = ['uuid', 'sanitize-html'];

module.exports = {
  ...nxPreset,
  transformIgnorePatterns: [
    // Everything under `node_modules` is ignored unless one of the names above
    // appears as a directory below it, which is what covers a nested copy.
    //
    // The prefix is anchored and forbids an earlier `node_modules`, so the scan
    // happens once, at the first one. Without that a checkout living under a
    // directory sharing one of these names would un-ignore every dependency --
    // and the nested copy this is for would be missed anyway, because the
    // engine would simply retry at the inner `node_modules`.
    `^(?:(?!/node_modules/).)*/node_modules/(?!(?:.*/)?(?:${esmDeps.join('|')})/)`,
    '\\.pnp\\.[^\\/]+$',
  ],
};
