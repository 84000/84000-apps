import React from 'react';
import type { Metadata } from 'next';
import '@design-system-css';
import { FONTS } from '@design-system';
import { InterfaceContextProvider } from './context/InterfaceContext';
import { SessionProvider, GraphQLAuthProvider } from '@lib-user';

export const metadata: Metadata = {
  title: '84000 Studio',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="overscroll-none">
      <head>{FONTS}</head>
      <body>
        <InterfaceContextProvider>
          <SessionProvider>
            <GraphQLAuthProvider>{children}</GraphQLAuthProvider>
          </SessionProvider>
        </InterfaceContextProvider>
      </body>
    </html>
  );
}
