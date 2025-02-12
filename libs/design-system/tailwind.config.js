const { join } = require('path');
const sharedConfig = require('../../tailwind.base.config.js');

module.exports = {
  ...sharedConfig,
  content: [
    ...sharedConfig.content,
    'libs/design-system/**/*.{ts,tsx,html}', // Specific paths for design-system
  ],
};
