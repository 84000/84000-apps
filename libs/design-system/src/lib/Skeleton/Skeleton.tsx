import { cn } from '@eightyfourthousand/lib-utils';

/**
 * A loading placeholder.
 *
 * Carries `data-skeleton` so the WebKit guard in `theme/global.css` can switch
 * the animation off there — a running animation during a large DOM subtree
 * replacement can wedge WebKit's main thread permanently (DEV-768). Blink and
 * Gecko keep the pulse.
 *
 * Prefer `SkeletonGroup` when several of these sit together: one animation for
 * the group instead of one per placeholder, in every engine.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-skeleton=""
      className={cn('animate-pulse rounded-md bg-foreground/10', className)}
      {...props}
    />
  );
}

/**
 * Wraps several `Skeleton`s so the group pulses as one.
 *
 * The children already animate in lockstep — same keyframes, same start — so
 * hoisting the animation here is visually equivalent while running one
 * animation instead of N. Children opt out with `animate-none`, which
 * `tailwind-merge` resolves against the `animate-pulse` in `Skeleton`'s own
 * class list, leaving them with no animation at all.
 */
function SkeletonGroup({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-skeleton=""
      className={cn('animate-pulse', className)}
      {...props}
    />
  );
}

export { Skeleton, SkeletonGroup };
