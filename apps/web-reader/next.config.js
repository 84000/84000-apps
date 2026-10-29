import { composePlugins, withNx } from '@nx/next';

/**
 * A local stand-in for the public reader (`public-reading-room`), built against
 * the working tree so reader changes can be tried before the libs are released.
 * It is not deployed.
 *
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {},
  env: {
    // Draft by default, as web-main's reader read: the local seed has no
    // published snapshots, so `published` renders every work empty. Set
    // NEXT_PUBLIC_CONTENT_SOURCE=published in .env.local to read the snapshot
    // the public reader serves.
    NEXT_PUBLIC_CONTENT_SOURCE: process.env.NEXT_PUBLIC_CONTENT_SOURCE || 'draft',
    // Pinned so a copy of web-main's .env.local (`studio`) does not give this
    // app the studio's feature flags.
    NEXT_PUBLIC_APPLICATION_NAME: 'web-reader',
  },
  async rewrites() {
    return [
      // Short links the public reader also accepts: /toh123 and /entity/...
      {
        source: '/:slug(toh[0-9]+[a-z0-9-]*)',
        destination: '/translation/:slug',
      },
      {
        source: '/entity/:type/:slug',
        destination: '/translation/entity/:type/:slug',
      },
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
    ];
  },
};

const plugins = [withNx];

export default composePlugins(...plugins)(nextConfig);
