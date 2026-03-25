import React from 'react';
import type { Metadata } from 'next';
import '@eightyfourthousand/design-system/css';
import { FONTS } from '@eightyfourthousand/design-system';

export const metadata: Metadata = {
  title: '84000 Translation Reader',
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
