'use client';

import { cn } from '@lib-utils';
import Link from 'next/link';
import { ReactNode } from 'react';

export const LabeledElement = ({
  label,
  id = undefined,
  className,
  children,
}: {
  label?: string;
  id?: string;
  className?: string;
  children: ReactNode;
}) => {
  return (
    <div id={id} className="relative ml-6 scroll-m-20">
      <Link
        href={`#${id}`}
        className={cn(
          'absolute labeled -left-16 w-16 text-end hover:cursor-pointer',
          className,
        )}
      >
        {label || ''}
      </Link>
      <div className="passage pl-6">{children}</div>
    </div>
  );
};
