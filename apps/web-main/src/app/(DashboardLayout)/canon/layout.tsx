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
      <div className="fixed flex flex-col size-full p-2">
        <div className="h-20" />
        <header className="sticky top-0 z-50">
          <Header />
        </header>
        <ResizablePanelGroup
          direction="horizontal"
          className="rounded-lg border bg-surface"
        >
          <ResizablePanel
            id="sidebar"
            defaultSize={20}
            minSize={10}
            maxSize={40}
            className="border-r border-r-border/50"
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
