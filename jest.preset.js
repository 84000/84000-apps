const nxPreset = require('@nx/jest/preset').default;

// Dependencies that reach Jest as ESM, which it cannot require as-is. Naming a
// package here also covers its own nested dependencies, which npm installs
// under `node_modules/<pkg>/node_modules/` and which are ESM just as often.
//
// Un-ignoring is only half of it: `@nx/react/babel` leaves `import` alone, so
// each project's transform adds `@babel/plugin-transform-modules-commonjs`.
const esmDeps = ['uuid', 'sanitize-html'];

module.exports = {
  ...nxPreset,
  transformIgnorePatterns: [
    // Matched against the whole path rather than each `node_modules` segment,
    // so a nested copy is transformed along with the package that brought it.
    `^(?!.*/(?:${esmDeps.join('|')})/).*/node_modules/`,
    '\\.pnp\\.[^\\/]+$',
  ],
};
