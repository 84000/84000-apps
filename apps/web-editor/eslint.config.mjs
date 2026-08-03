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
      '@next/next/no-html-link-for-pages': ['error', 'app/web-editor/pages'],
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
    ignores: [
      '.next/**/*',
      // Vendored SQLite WASM glue and the pre-bundled storage coordinator,
      // emitted by tools/build-storage-assets.mjs. Build output, not source.
      'public/sqlite-wasm/**/*',
      'public/storage-workers/**/*',
    ],
  },
];
