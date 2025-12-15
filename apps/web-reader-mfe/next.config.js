import { composePlugins, withNx } from '@nx/next';
import { withMicrofrontends } from '@vercel/microfrontends/next/config';

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {},
};

const mfe = process.env.MICROFRONTEND ? [withMicrofrontends] : [];

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
  ...mfe,
];

export default composePlugins(...plugins)(nextConfig);
