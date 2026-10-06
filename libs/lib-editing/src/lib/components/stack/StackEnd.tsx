'use client';

import { LotusPond } from '@eightyfourthousand/design-system';

import { PassageSkeleton } from '../shared/PassageSkeleton';

const LOADING_SKELETONS_COUNT = 3;

/**
 * What follows the last row: placeholders while the work has more to load,
 * and the lotus pond once it doesn't — the same close the paginated editor
 * and the reader draw. In the right panel the pond is hidden and only its
 * padding remains.
 */
export const StackEnd = ({ hasMore }: { hasMore: boolean }) =>
  hasMore ? (
    <div className="flex flex-col gap-4 pb-8 pt-6" data-stack-end="loading">
      {Array.from({ length: LOADING_SKELETONS_COUNT }).map((_, i) => (
        <PassageSkeleton key={i} />
      ))}
    </div>
  ) : (
    <div className="w-full pt-16 pb-6 @c/sidebar:pt-8" data-stack-end="done">
      <LotusPond className="@c/sidebar:hidden mx-auto w-96" />
    </div>
  );
