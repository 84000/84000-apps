const sharedConfig = require('../../tailwind.base.config.js');

module.exports = {
  ...sharedConfig,
  content: [
    ...sharedConfig.content,
    'apps/web-main/**/*.{ts,tsx,html}', // Specific paths for web-main
  ],
};
