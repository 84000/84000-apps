'use client';

import { MenuIcon } from 'lucide-react';
import { Button } from '../Button/Button';
import MainLogo from '../MainLogo/MainLogo';

export function Header({
  children,
  toggleSidebar,
}: {
  children: React.ReactNode;
  toggleSidebar?: () => void | undefined;
}) {
  return (
    <header className="flex sticky top-0 z-50 w-full items-center bg-background shadow-sm shadow-background/50">
      <div className="flex h-20 w-full items-center gap-2 px-4">
        <div className="hidden md:flex flex-col justify-center h-12">
          <MainLogo width={112} />
        </div>
        {toggleSidebar && (
          <Button
            className="size-8"
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
          >
            <MenuIcon />
          </Button>
        )}
        {children}
      </div>
    </header>
  );
}
