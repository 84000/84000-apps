import baseConfig from '../../eslint.config.mjs';
import nx from '@nx/eslint-plugin';
import next from 'eslint-config-next/core-web-vitals';

export default [
  ...baseConfig,
  ...nx.configs['flat/react-typescript'],
  ...next,
  { ignores: ['.next/**/*'] },
];
