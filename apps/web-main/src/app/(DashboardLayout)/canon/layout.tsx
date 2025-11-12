import { createBrowserClient, getCanonTree } from '@data-access';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  ScrollArea,
} from '@design-system';
import { CanonProvider, Header } from '@lib-canon';
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
      <div className="fixed flex flex-col size-full">
        <div className="h-23" />
        <header className="sticky top-0 z-50 border-b-3 border-white">
          <Header />
        </header>
        <ResizablePanelGroup direction="horizontal">
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
          <ResizablePanel id="main">{children}</ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </CanonProvider>
  );
};

export default Layout;
