'use client';

import { Skeleton } from '@eightyfourthousand/design-system';

/** Space between one passage's block and the next. */
const GAP_PX = 8;

/**
 * The placeholder a row shows until its content can be drawn.
 *
 * One block per passage, at the row's estimated height. When the passage's length is known
 * that is the height the real content will take, which is what keeps rows from
 * shifting as they hydrate; when it is not, the block stands at a neutral
 * fallback. `data-passage-skeleton` says which, so a row that turns out to be
 * mis-sized can be traced back to whether a size was available at all.
 *
 * The design system's `Skeleton` rather than a bare `animate-pulse`, for a
 * reason that matters here more than anywhere else in the app: it carries
 * `data-skeleton`, which the WebKit guard keys off to stop the animation. A
 * running animation during a large DOM subtree replacement can wedge WebKit's
 * main thread permanently, and a virtualized list replaces subtrees
 * continuously. It also brings `bg-foreground/10` — `bg-muted` is the studio's
 * own page background, which draws a placeholder nobody can see.
 */
export const PassageSkeleton = ({
  height,
  sized,
}: {
  /** The row's estimated content height, in pixels. */
  height: number;
  /** Whether that height came from this passage's own length. */
  sized: boolean;
}) => (
  <Skeleton
    className="w-full"
    style={{
      height,
      // The gap between passages is a transparent bottom border rather than a
      // margin: the row has no padding by design, so a margin would collapse
      // out of it and the block would no longer measure its own height — and
      // this *is* what the virtualizer measures. `border-box` keeps the
      // element exactly `height`, and clipping the background to the padding
      // box stops it painting under the border.
      boxSizing: 'border-box',
      borderBottom: `${GAP_PX}px solid transparent`,
      backgroundClip: 'padding-box',
    }}
    aria-hidden="true"
    data-passage-skeleton={sized ? 'sized' : 'generic'}
  />
);
