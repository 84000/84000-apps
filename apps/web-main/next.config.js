import { composePlugins, withNx } from '@nx/next';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { PostHog } from 'posthog-node';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configDir = join(__dirname, 'src/config');
const studioRoutesPath = join(configDir, 'studio-routes.json');

/**
 * Fetches studio header config from PostHog and writes to disk for proxy.ts.
 */
async function fetchAndWriteStudioRoutes() {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  const emptyConfig = { rewrites: [], publicRoutes: [], restrictedRoutes: {} };

  if (!apiKey || !host) {
    writeStudioRoutes(emptyConfig);
    return emptyConfig;
  }

  const client = new PostHog(apiKey, { host });

  try {
    const payload = await client.getFeatureFlagPayload(
      'studio-header-config',
      'build-user'
    );

    if (!payload?.items) {
      writeStudioRoutes(emptyConfig);
      return emptyConfig;
    }

    const config = { rewrites: [], publicRoutes: [], restrictedRoutes: {} };

    for (const menuItem of payload.items) {
      for (const subItem of menuItem.items || []) {
        if (subItem.proxyTo) {
          config.rewrites.push({
            source: `${subItem.href}/:path*`,
            destination: `${subItem.proxyTo}/:path*`,
          });
        }
        if (subItem.public) {
          config.publicRoutes.push(subItem.href);
        }
        if (subItem.roles?.length) {
          config.restrictedRoutes[subItem.href] = subItem.roles;
        }
      }
    }

    writeStudioRoutes(config);
    return config;
  } catch (error) {
    console.warn('[next.config] Failed to fetch studio config:', error.message);
    writeStudioRoutes(emptyConfig);
    return emptyConfig;
  } finally {
    await client.shutdown();
  }
}

function writeStudioRoutes(config) {
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  writeFileSync(studioRoutesPath, JSON.stringify(config, null, 2));
}

// Fetch config at startup using top-level await
const studioRoutes = await fetchAndWriteStudioRoutes();

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
  async rewrites() {
    return studioRoutes.rewrites || [];
  },
};

const plugins = [withNx];

export default composePlugins(...plugins)(nextConfig);
