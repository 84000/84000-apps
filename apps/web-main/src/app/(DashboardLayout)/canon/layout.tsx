import { createBrowserClient, getCanonTree } from '@data-access';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  ScrollArea,
} from '@design-system';
import { CanonProvider } from '@lib-canon';
import { notFound } from 'next/navigation';
import { ReactNode } from 'react';

const Layout = async ({
  children,
  sidebar,
}: {
  children: ReactNode;
  sidebar: ReactNode;
}) => {
  const client = createBrowserClient();
  const canon = await getCanonTree({ client });

  if (!canon) {
    return notFound();
  }

  return (
    <CanonProvider canon={canon}>
      <div className="flex flex-col h-full w-full">
        <header className="sticky top-0 z-50 border-b-3 border-white">
          <div className="flex items-center justify-between h-16 px-4 border-b-3 border-border">
            <h1 className="text-xl font-semibold text-navy">Canon Navigator</h1>
          </div>
        </header>
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel
            id="sidebar"
            defaultSize={20}
            minSize={10}
            maxSize={40}
            className="bg-gray/20"
          >
            <ScrollArea className="h-full">{sidebar}</ScrollArea>
          </ResizablePanel>
          <ResizableHandle className="bg-transparent" />
          <ResizablePanel id="main" className="bg-gray/50">
            <ScrollArea className="h-full">{children}</ScrollArea>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </CanonProvider>
  );
};

export default Layout;
