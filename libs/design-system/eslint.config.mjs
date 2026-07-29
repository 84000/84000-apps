import baseConfig from '../../eslint.config.mjs';
import nx from '@nx/eslint-plugin';
import storybook from 'eslint-plugin-storybook';

export default [
  ...baseConfig,
  ...nx.configs['flat/react'],
  ...storybook.configs['flat/recommended'],
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    // Override or add rules here
    rules: {},
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
    ignores: ['storybook-static/**', 'dist/**'],
  },
];
