import React from 'react';
import type { Metadata } from 'next';
import '@eightyfourthousand/design-system/css';
import { FONTS, TooltipProvider } from '@eightyfourthousand/design-system';

export const metadata: Metadata = {
  title: '84000 Reader (local)',
  description: 'Local stand-in for the public 84000 reader.',
  robots: { index: false, follow: false },
};

/**
 * No session, auth or GraphQL auth providers: the public reader is anonymous,
 * and so is this. Compare web-main's root layout, which wraps everything in
 * `SessionProvider` and `GraphQLAuthProvider`.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="overscroll-none">
      <head>{FONTS}</head>
      <body>
        <TooltipProvider>
          <div className="fixed size-full overflow-auto">{children}</div>
        </TooltipProvider>
      </body>
    </html>
  );
}
