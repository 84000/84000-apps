import { composePlugins, withNx } from '@nx/next';

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {},
  // This app edits translations, so every read it makes resolves against the
  // draft tables. That is also the default today, so this is a pin rather than a
  // change: it keeps the editor on draft if the default is ever flipped to
  // published. Declared here rather than in .env.local so it is
  // version-controlled and visible in review.
  env: { NEXT_PUBLIC_CONTENT_SOURCE: 'draft' },
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

export default composePlugins(...plugins)(nextConfig);
