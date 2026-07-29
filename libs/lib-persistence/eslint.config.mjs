import baseConfig from '../../eslint.config.mjs';
import nx from '@nx/eslint-plugin';

export default [
  ...baseConfig,
  ...nx.configs['flat/react'],
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
    // Worker entry points run in a WorkerGlobalScope, where `self` is the only
    // handle to the global object. The base config bans it because in a window
    // context it is a confusing alias for `window`.
    files: ['**/*.worker.ts', '**/*.sharedworker.ts'],
    rules: {
      'no-restricted-globals': 'off',
    },
  },
];
