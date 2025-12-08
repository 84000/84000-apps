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
    <header className="flex sticky top-0 z-50 w-full items-center bg-background shadow-sm">
      <div className="flex h-18 w-full items-center gap-2 px-4">
        <div className="hidden md:flex flex-col justify-center">
          <MainLogo width={96} />
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
