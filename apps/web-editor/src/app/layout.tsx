import { ReactNode } from 'react';
import type { Metadata } from 'next';
import '@design-system-css';
import { Fonts } from '@design-system';
import { SandboxHeader } from '../components/SandboxHeader';
import { SandboxProvider } from '../components/SandboxProvider';

export const metadata: Metadata = {
  title: 'Collaborative Editor Sandbox',
  description: 'A sandbox for collaborative editing features',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Fonts />
      </head>
      <body>
        <SandboxProvider>
          <SandboxHeader />
          <div className="h-20" />
          <div className="w-full overflow-auto px-8 max-w-readable mx-auto">
            {children}
          </div>
          <div className="h-20" />
        </SandboxProvider>
      </body>
    </html>
  );
}
