'use client';

import { LotusPond } from '@eightyfourthousand/design-system';

import { PassageSkeleton } from '../shared/PassageSkeleton';

const LOADING_SKELETONS_COUNT = 3;

/**
 * The height `StackStart` takes: its top padding plus three skeletons and the
 * gaps between them. Fixed, because the list's rows are placed below it.
 */
export const STACK_START_PX = 24 + 3 * 128 + 2 * 16;

/**
 * What precedes the first row while the work has passages before it: the
 * placeholders the paginated editor draws above a window that starts mid-work.
 * Absolutely placed in the space the list reserves for it.
 */
export const StackStart = () => (
  <div
    className="absolute left-0 top-0 flex w-full flex-col gap-4 overflow-hidden pt-6"
    style={{ height: STACK_START_PX }}
    data-stack-start="loading"
  >
    {Array.from({ length: LOADING_SKELETONS_COUNT }).map((_, i) => (
      <PassageSkeleton key={i} />
    ))}
  </div>
);

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
