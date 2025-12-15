//@ts-check

// eslint-disable @typescript-eslint/no-require-imports
const { composePlugins, withNx } = require('@nx/next');
// eslint-enable @typescript-eslint/no-require-imports

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {},
  images: {
    remotePatterns: [
      { hostname: 'lh3.googleusercontent.com' },
      { hostname: 'ivwvvjgudwqwjbclvfjy.supabase.co' },
      { hostname: 'cdn.prod.website-files.com' },
    ],
  },
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
