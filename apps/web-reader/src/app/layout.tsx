import React from 'react';
import type { Metadata } from 'next';
import '@eightyfourthousand/design-system/css';
import { FONTS } from '@eightyfourthousand/design-system';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://84000.co';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: '84000 Translation Reader',
    template: '%s | 84000',
  },
  description:
    'Read translations from the Tibetan Buddhist canon published by 84000.',
  applicationName: '84000 Translation Reader',
  openGraph: {
    siteName: '84000: Translating the Words of the Buddha',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>{FONTS}</head>
      <body>
        <div className="fixed size-full overflow-auto">{children}</div>
      </body>
    </html>
  );
}
