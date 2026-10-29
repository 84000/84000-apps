import type { MetadataRoute } from 'next';

/** Not deployed, and never meant to be indexed if it is run somewhere public. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } };
}
