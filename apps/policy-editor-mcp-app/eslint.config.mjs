import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    // Build output: the generated HTML module is a 1 MB string literal.
    ignores: ['generated/**'],
  },
  {
    // The browser bundle must never pull in server code. Specs may.
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.spec.ts'],
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
