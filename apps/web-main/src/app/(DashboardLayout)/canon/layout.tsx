import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@design-system';
import { ReactNode } from 'react';

const Layout = ({
  children,
  sidebar,
}: {
  children: ReactNode;
  sidebar: ReactNode;
}) => {
  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      <ResizablePanel
        id="sidebar max-width-[400px]"
        defaultSize={20}
        minSize={10}
        maxSize={40}
        className="border-t border-t-sidebar-border bg-gray/20 overflow-auto"
      >
        <div className="p-4">{sidebar}</div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel id="main">
        <div className="px-4">{children}</div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};

export default Layout;
