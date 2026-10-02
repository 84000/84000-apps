'use client';

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
}: {
  tab: string;
  className?: string;
}) => {
  const stack = useStackWork();
  const controller = stack?.controllerFor(tab);
  useStackOuterContent(tab === 'front' ? controller : null);

  if (!controller) {
    return <TranslationSkeleton />;
  }

  return <PassageStack controller={controller} className={className} />;
};
