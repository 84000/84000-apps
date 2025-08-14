import React from 'react';
import type { Metadata } from 'next';
import '@design-system-css';
import { InterfaceContextProvider } from './context/InterfaceContext';
import { SessionProvider } from './context/SessionContext';

export const metadata: Metadata = {
  title: "84000 Scholar's Room",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.png" type="image/svg+xml" />
      </head>
      <body>
        <InterfaceContextProvider>
          <SessionProvider>{children}</SessionProvider>
        </InterfaceContextProvider>
      </body>
    </html>
  );
}
