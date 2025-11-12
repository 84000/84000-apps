import { ReactNode } from 'react';
import type { Metadata } from 'next';
import '@design-system-css';
import { SandboxHeader } from '../components/SandoxHeader';
import { SandboxProvider } from '../components/SandboxProvider';

export const metadata: Metadata = {
  title: 'Collaorative Editor Sandbox',
  description: 'A sandbox for collaborative editing features',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SandboxProvider>
          <SandboxHeader />
          <div className="flex flex-1 py-20">
            <div className="fixed h-screen w-full overflow-auto px-8">
              {children}
            </div>
          </div>
        </SandboxProvider>
      </body>
    </html>
  );
}
