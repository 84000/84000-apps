//@ts-check

import { composePlugins, withNx } from '@nx/next';
import nextra from 'nextra';

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  assetPrefix: process.env.NODE_ENV === 'production' ? '/docs' : undefined,
};

const withNextra = nextra({
  contentDirBasePath:
    process.env.NODE_ENV === 'production' ? '/docs' : undefined,
});

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
  withNextra,
];

const config = composePlugins(...plugins)(nextConfig);

export default config;
