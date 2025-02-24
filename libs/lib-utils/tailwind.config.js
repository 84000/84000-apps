import { join } from 'path';
import { createGlobPatternsForDependencies } from '@nx/react/tailwind';

const sharedConfig = require('../../tailwind.base.config.js');

module.exports = {
  ...sharedConfig,
  content: [
    join(
      __dirname,
      '{src,pages,components,app}/**/*!(*.stories|*.spec).{ts,tsx,html}'
    ),
    join(__dirname, '../../node_modules/flowbite-react/dist/esm/**/*.mjs'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
};
