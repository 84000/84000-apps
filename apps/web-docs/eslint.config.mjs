import baseConfig from '../../eslint.config.mjs';
import nx from '@nx/eslint-plugin';
import next from 'eslint-config-next/core-web-vitals';

export default [
  ...baseConfig,
  ...nx.configs['flat/react-typescript'],
  ...next,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@next/next/no-html-link-for-pages': ['error', 'apps/web-docs/pages'],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    // Override or add rules here
    rules: {},
  },
  {
    files: ['**/*.js', '**/*.jsx'],
    // Override or add rules here
    rules: {},
  },
  {
    ignores: ['.next/**/*'],
  },
];
