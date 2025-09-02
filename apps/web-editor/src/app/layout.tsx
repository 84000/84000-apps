import { ReactNode } from 'react';
import type { Metadata } from 'next';
import '@design-system-css';
import { H4 } from '@design-system';

export const metadata: Metadata = {
  title: 'Collaorative Editor Sandbox',
  description: 'A sandbox for collaborative editing features',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="[--header-height:calc(--spacing(20))]">
          <div className="fixed w-full z-50 bg-background border-b border-border">
            <H4 className="px-6">Editor Sandbox</H4>
          </div>
          <div className="flex flex-1 py-(--header-height)">
            <div className="fixed h-screen w-full overflow-auto px-8">
              {children}
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
