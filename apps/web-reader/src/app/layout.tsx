import React from 'react';
import type { Metadata } from 'next';
import '@design-system-css';

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
      <body>
        <div className="fixed size-full overflow-auto">{children}</div>
      </body>
    </html>
  );
}
