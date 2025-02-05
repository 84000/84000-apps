import React from 'react';
import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import 'simplebar-react/dist/simplebar.min.css';
import { Flowbite, ThemeModeScript } from 'flowbite-react';
import { theme } from '@design-system';
import './css/globals.css';

const manrope = Manrope({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MatDash-Nextjs-Free',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <ThemeModeScript />
      </head>
      <body className={`${manrope.className}`}>
        <Flowbite theme={{ theme: theme }}>{children}</Flowbite>
      </body>
    </html>
  );
}
