'use client';

import type { ReactNode } from 'react';
import { TranslationSkeleton } from '../shared/TranslationSkeleton';
import { PassageStack } from './PassageStack';
import { useStackWork } from './StackWorkProvider';
import { useStackOuterContent } from './useStackOuterContent';

/**
 * One editor tab, drawn as a passage stack.
 *
 * The only thing a host mounts. Everything behind it — the work, the spine,
 * the per-tab views — comes from `StackWorkProvider`, so a tab knows nothing
 * about the others while sharing their document and their undo history.
 */
export const StackTab = ({
  tab,
  className,
  fallback,
  title,
}: {
  tab: string;
  className?: string;
  /** Drawn when the work is ready but has no view for this tab. */
  fallback?: ReactNode;
  /** Drawn above the stack, never as one of its rows. */
  title?: ReactNode;
}) => {
  const stack = useStackWork();
  const controller = stack?.controllerFor(tab);
  useStackOuterContent(tab === 'front' ? controller : null);

  if (!controller) {
    return stack && fallback ? fallback : <TranslationSkeleton />;
  }

  return (
    <>
      {title}
      <PassageStack controller={controller} className={className} />
    </>
  );
};
