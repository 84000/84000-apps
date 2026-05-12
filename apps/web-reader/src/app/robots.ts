import type { MetadataRoute } from 'next';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://84000.co').replace(
  /\/$/,
  '',
);

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/mcp', '/local-storage'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
