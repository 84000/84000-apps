import React from 'react';
import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import '@design-system-css';
import { theme } from '@design-system';
import { Flowbite, ThemeModeScript } from 'flowbite-react';
import { InterfaceContextProvider } from './context/InterfaceContext';
import '../utils/i18n';
import { SessionProvider } from './context/SessionContext';

const manrope = Manrope({ subsets: ['latin'] });

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
        <ThemeModeScript />
      </head>
      <body className={`${manrope.className}`}>
        <Flowbite theme={{ theme }}>
          <InterfaceContextProvider>
            <SessionProvider>{children}</SessionProvider>
          </InterfaceContextProvider>
        </Flowbite>
      </body>
    </html>
  );
}
