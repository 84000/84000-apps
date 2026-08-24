import baseConfig from '../../eslint.config.mjs';

/**
 * The whole point of this library is that it runs anywhere — browser, worker,
 * and Next.js route handler alike — so a browser global reaching it is a
 * design failure, not a portability nit.
 *
 * TypeScript cannot catch it here: `data-access` is compiled from source and
 * transitively needs the DOM lib, so `dom` has to stay in `tsconfig.lib.json`
 * and every browser global is in scope as far as the compiler is concerned.
 * This rule is what actually holds the line.
 */
const BROWSER_GLOBALS = [
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'caches',
  'location',
  'self',
];

export default [
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.js'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...BROWSER_GLOBALS.map((name) => ({
          name,
          message: `${name} is a browser global; @eightyfourthousand/lib-doc-model must run in Node too.`,
        })),
      ],
    },
  },
];
