import baseConfig from '../../eslint.config.mjs';
import nx from '@nx/eslint-plugin';

export default [
  ...baseConfig,
  ...nx.configs['flat/react'],
  {
    // Build output: the generated HTML module is a 1 MB string literal.
    ignores: ['generated/**'],
  },
  {
    // The browser bundle must never pull in server code. Specs may.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.spec.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@eightyfourthousand/lib-agent',
                '@eightyfourthousand/lib-agent/*',
                '@eightyfourthousand/data-access',
                '@eightyfourthousand/data-access/*',
              ],
              message: 'The browser bundle must not import server code.',
            },
          ],
        },
      ],
    },
  },
];
