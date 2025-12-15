import { composePlugins, withNx } from '@nx/next';
import { withMicrofrontends } from '@vercel/microfrontends/next/config';

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {},
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
  withMicrofrontends,
];

export default composePlugins(...plugins)(nextConfig);
