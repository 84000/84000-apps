import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    // Build output: the generated HTML module is a 1 MB string literal.
    ignores: ['generated/**'],
  },
];
