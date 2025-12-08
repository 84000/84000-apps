'use client';

import { CanonNode } from '@data-access';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@design-system';
import { cn } from '@lib-utils';
import { useCanon } from '../context';

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
  const { setCurrent, isActive } = useCanon();

  const baseStyle =
    'w-full py-2 font-normal leading-6 text-foreground/60 hover:no-underline hover:text-foreground hover:cursor-default';
  const depthClass = `pl-${depth * 2}`;

  if (!node.children?.length) {
    return null;
  }

  return (
    <Accordion type="single" collapsible className={depthClass}>
      {node.children.map((child) => {
        return child.children?.length ? (
          <AccordionItem
            key={child.uuid}
            value={child.uuid}
            className="border-b-0"
          >
            <AccordionTrigger
              className={cn(
                baseStyle,
                className,
                isActive(child.uuid) ? 'text-foreground' : '',
              )}
            >
              <div className="w-full" onClick={() => setCurrent(child.uuid)}>
                {child.label}
              </div>
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
            className={cn(
              baseStyle,
              isActive(child.uuid) ? 'text-foreground' : '',
            )}
            onClick={() => setCurrent(child.uuid)}
          >
            {child.label}
          </div>
        );
      })}
    </Accordion>
  );
};
