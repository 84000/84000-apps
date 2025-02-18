import React from 'react';
import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import '@design-system-css';
import { theme } from '@design-system';
import { Flowbite, ThemeModeScript } from 'flowbite-react';
import { CustomizerContextProvider } from './context/CustomizerContext';
import '../utils/i18n';
import { SessionProvider } from './context/SessionContext';

const manrope = Manrope({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Matdash - Nextjs',
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
          <CustomizerContextProvider>
            <SessionProvider>{children}</SessionProvider>
          </CustomizerContextProvider>
        </Flowbite>
      </body>
    </html>
  );
}
