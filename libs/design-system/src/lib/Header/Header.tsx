'use client';

import { MenuIcon } from 'lucide-react';
import { Button } from '../Button/Button';
import { Separator } from '../Separator/Separator';
import MiniLogo from '../MiniLogo/MiniLogo';
import Link from 'next/link';

export function Header({
  children,
  toggleSidebar,
}: {
  children: React.ReactNode;
  toggleSidebar: () => void;
}) {
  return (
    <header className="fle sticky top-0 z-50 w-full items-center border-b bg-background">
      <div className="flex h-[--header-height] w-full items-center gap-2 px-4">
        <Link className="h-12 w-8 px-0 py-2" href="/">
          <MiniLogo />
        </Link>
        <Button
          className="h-8 w-8"
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
        >
          <MenuIcon />
        </Button>
        <Separator orientation="vertical" className="mr-2 h-4" />
        {children}
      </div>
    </header>
  );
}
