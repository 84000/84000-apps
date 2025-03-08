//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
import { composePlugins, withNx } from '@nx/next';
import nextra from 'nextra';

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {
    // Set this to true if you would like to use SVGR
    // See: https://github.com/gregberge/svgr
    svgr: false,
  },
};

const withNextra = nextra({});

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
  withNextra,
];

const config = composePlugins(...plugins)(nextConfig);

export default config;
