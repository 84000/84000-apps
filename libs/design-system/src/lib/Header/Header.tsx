'use client';

import { MenuIcon } from 'lucide-react';
import { Button } from '../Button/Button';
import MiniLogo from '../MiniLogo/MiniLogo';

export function Header({
  children,
  toggleSidebar,
}: {
  children: React.ReactNode;
  toggleSidebar: () => void;
}) {
  return (
    <header className="flex sticky top-0 z-50 w-full items-center border-b border-border bg-background">
      <div className="flex h-(--header-height) w-full items-center gap-2 pl-2 pr-4">
        <div className="h-12 w-8 px-0 py-2">
          <MiniLogo />
        </div>
        <Button
          className="h-8 w-8"
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
        >
          <MenuIcon />
        </Button>
        {children}
      </div>
    </header>
  );
}
