const { createGlobPatternsForDependencies } = require('@nx/react/tailwind');
const { join } = require('path');
const sharedConfig = require('../../tailwind.base.config.js');

module.exports = {
  ...sharedConfig,
  content: [
    join(
      __dirname,
      '{src,pages,components,app}/**/*!(*.stories|*.spec).{ts,tsx,html}'
    ),
    ...createGlobPatternsForDependencies(__dirname),
    ...sharedConfig.content,
    'apps/web-main/**/*.{ts,tsx,html}', // Specific paths for web-main
  ],
};
