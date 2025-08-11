'use client';

import { CanonNode } from '@data-access';
import { useRouter } from 'next/navigation';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@design-system';
import { cn } from '@lib-utils';

export const CanonNavigator = ({
  node,
  breadcrumbs = ['Canon'],
  className,
  depth = 0,
}: {
  node: CanonNode;
  breadcrumbs?: string[];
  className?: string;
  depth?: number;
}) => {
  const router = useRouter();

  const baseStyle =
    'w-full py-2 font-normal leading-6 text-primary/60 hover:no-underline hover:text-primary';
  const depthClass = `pl-${depth * 2}`;

  if (!node.children?.length) {
    return null;
  }

  const onClickHandler = (label: string) => {
    const newBreadcrumbs = [...breadcrumbs, label || ''];
    const encoded = newBreadcrumbs
      .map((crumb) => crumb.replace(/\s+/g, '-').toLowerCase())
      .join('/');
    router.push(`/${encoded}`);
  };

  return (
    <Accordion type="single" collapsible className={cn(depthClass)}>
      {node.children.map((child) => {
        return child.children?.length ? (
          <AccordionItem
            key={child.uuid}
            value={child.uuid}
            className="border-b-0"
          >
            <AccordionTrigger
              className={cn(baseStyle, className)}
              onClick={() => onClickHandler(child.label || '')}
            >
              {child.label}
            </AccordionTrigger>
            <AccordionContent className={cn(depthClass, 'py-0')}>
              <CanonNavigator
                node={child}
                depth={depth + 1}
                breadcrumbs={[...breadcrumbs, child.label || '']}
              />
            </AccordionContent>
          </AccordionItem>
        ) : (
          <div
            key={child.uuid}
            className={cn(baseStyle)}
            onClick={() => onClickHandler(child.label || '')}
          >
            {child.label}
          </div>
        );
      })}
    </Accordion>
  );
};
