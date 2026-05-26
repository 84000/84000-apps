const nxPreset = require('@nx/jest/preset').default;

// These dependencies publish native ESM only, which Jest cannot require as-is.
// Un-ignore them so babel-jest transpiles them to CJS.
const esmDeps = ['uuid'];

module.exports = {
  ...nxPreset,
  transformIgnorePatterns: [
    `/node_modules/(?!(?:${esmDeps.join('|')})/)`,
    '\\.pnp\\.[^\\/]+$',
  ],
};
