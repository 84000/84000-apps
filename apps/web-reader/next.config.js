//@ts-check

import { composePlugins, withNx } from '@nx/next';
import { withMicrofrontends } from '@vercel/microfrontends/next/config';

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {},
};

const mfe = process.env.MICROFRONTENDS ? [withMicrofrontends] : [];

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
  ...mfe,
];

module.exports = composePlugins(...plugins)(nextConfig);
