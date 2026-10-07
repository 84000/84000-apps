import { cn } from '@eightyfourthousand/lib-utils';
import type { ReactNode } from 'react';

/** One line of a line diff: only in the old text, only in the new, or in both. */
export interface DiffLine {
  type: 'removed' | 'added' | 'unchanged';
  text: string;
}

/**
 * Past this many lines-squared in the changed middle, the diff stops looking
 * for common lines there and shows the old middle removed and the new added.
 */
const MAX_CELLS = 4_000_000;

/** Splits into lines, ignoring the empty line after a final newline. */
const toLines = (text: string) =>
  text === '' ? [] : text.replace(/\n$/, '').split('\n');

const line = (type: DiffLine['type']) => (text: string) => ({ type, text });

/**
 * A line diff of `oldText` to `newText`, in order: a longest common
 * subsequence of lines after trimming the common head and tail. A trailing
 * newline is ignored.
 */
export const diffLines = (oldText: string, newText: string): DiffLine[] => {
  const a = toLines(oldText);
  const b = toLines(newText);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) {
    start++;
  }
  let [endA, endB] = [a.length, b.length];
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const x = a.slice(start, endA);
  const y = b.slice(start, endB);
  let middle: DiffLine[] = [];
  if (x.length * y.length > MAX_CELLS) {
    // Not push(...): that overflows the stack on a very long text.
    middle = [...x.map(line('removed')), ...y.map(line('added'))];
  } else {
    // common[i * w + j] is the LCS length of x[i..] and y[j..].
    const w = y.length + 1;
    const common = new Uint16Array((x.length + 1) * w);
    for (let i = x.length - 1; i >= 0; i--) {
      for (let j = y.length - 1; j >= 0; j--) {
        common[i * w + j] =
          x[i] === y[j]
            ? common[(i + 1) * w + j + 1] + 1
            : Math.max(common[(i + 1) * w + j], common[i * w + j + 1]);
      }
    }
    let [i, j] = [0, 0];
    while (i < x.length || j < y.length) {
      if (i < x.length && j < y.length && x[i] === y[j]) {
        middle.push({ type: 'unchanged', text: x[i] });
        i++;
        j++;
      } else if (
        j === y.length ||
        (i < x.length && common[(i + 1) * w + j] >= common[i * w + j + 1])
      ) {
        middle.push({ type: 'removed', text: x[i++] });
      } else {
        middle.push({ type: 'added', text: y[j++] });
      }
    }
  }
  return [
    ...a.slice(0, start).map(line('unchanged')),
    ...middle,
    ...a.slice(endA).map(line('unchanged')),
  ];
};

/** Props for {@link DiffView}. */
export interface DiffViewProps {
  oldText: string;
  newText: string;
  /** Names the old side in the legend, e.g. "Saved version". */
  oldLabel?: ReactNode;
  /** Names the new side in the legend, e.g. "Your changes". */
  newLabel?: ReactNode;
  /** Shown instead of the lines when the texts have the same lines. */
  sameMessage?: ReactNode;
  className?: string;
}

const MARK = { removed: '-', added: '+', unchanged: ' ' } as const;
const SPOKEN = { removed: 'Removed: ', added: 'Added: ', unchanged: '' };

/**
 * A line diff of two texts. Removed and added lines are `<del>` and `<ins>`,
 * marked with `-` and `+` and announced as such, so the diff never relies on
 * colour; a legend says which side each mark belongs to.
 */
export const DiffView = ({
  oldText,
  newText,
  oldLabel = 'Old',
  newLabel = 'New',
  sameMessage = 'There are no differences.',
  className,
}: DiffViewProps) => {
  const lines = diffLines(oldText, newText);
  const count = (type: DiffLine['type']) =>
    lines.filter((diffLine) => diffLine.type === type).length;
  const changed = lines.some(({ type }) => type !== 'unchanged');

  return (
    <figure className={cn('flex min-h-0 flex-col gap-2', className)}>
      <figcaption className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
        <span>
          <span aria-hidden>- </span>
          {oldLabel} ({count('removed')} removed)
        </span>
        <span>
          <span aria-hidden>+ </span>
          {newLabel} ({count('added')} added)
        </span>
      </figcaption>
      {changed ? (
        <pre
          // Focusable so the keyboard can scroll it.
          tabIndex={0}
          className="min-h-0 overflow-auto rounded-md border py-2 font-mono text-sm"
        >
          {lines.map(({ type, text }, index) => {
            const Line =
              type === 'removed' ? 'del' : type === 'added' ? 'ins' : 'span';
            return (
              <Line
                key={index}
                className={cn(
                  'block whitespace-pre-wrap px-3 no-underline',
                  type === 'removed' && 'bg-destructive/10',
                  type === 'added' && 'bg-success/15',
                )}
              >
                <span aria-hidden className="select-none">
                  {MARK[type]}{' '}
                </span>
                <span className="sr-only">{SPOKEN[type]}</span>
                {text}
                {'\n'}
              </Line>
            );
          })}
        </pre>
      ) : (
        <p className="text-sm">{sameMessage}</p>
      )}
    </figure>
  );
};
