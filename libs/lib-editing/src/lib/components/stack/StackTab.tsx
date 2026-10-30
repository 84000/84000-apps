'use client';

import type { ReactNode } from 'react';
import { TranslationSkeleton } from '../shared/TranslationSkeleton';
import { PassageStack } from './PassageStack';
import { useStackWork } from './stack-work-context';
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
}: {
  tab: string;
  className?: string;
  /** Drawn when the work is ready but has no view for this tab. */
  fallback?: ReactNode;
}) => {
  const stack = useStackWork();
  const controller = stack?.controllerFor(tab);
  useStackOuterContent(tab === 'front' ? controller : null);

  if (!controller) {
    return stack && fallback ? fallback : <TranslationSkeleton />;
  }

  return <PassageStack controller={controller} className={className} />;
};
