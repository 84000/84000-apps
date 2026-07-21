'use client';

/**
 * Highlights a character range within a DOM subtree using the CSS Custom
 * Highlight API. Unlike wrapping text in `<mark>`, this paints the range
 * without mutating the DOM — essential for content rendered by ProseMirror /
 * TipTap, where DOM mutations trigger a reparse loop.
 *
 * The `::highlight(deep-link)` rule that styles the range is injected at
 * runtime (below) rather than authored in a stylesheet — build-time CSS
 * tooling (Tailwind v4 / lightningcss) rejects the `::highlight()`
 * pseudo-element, but the browser CSSOM parses it fine.
 */

const HIGHLIGHT_NAME = 'deep-link';
const STYLE_ELEMENT_ID = 'deep-link-highlight-style';

// Uses the shared `--color-highlight` token (the same color `bg-highlight`
// resolves to), defined in the design-system theme.
const HIGHLIGHT_STYLE = `::highlight(${HIGHLIGHT_NAME}) {
  background-color: var(--color-highlight);
}`;

/** Injects the `::highlight()` rule once, on first use. */
const ensureHighlightStyle = () => {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ELEMENT_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = HIGHLIGHT_STYLE;
  document.head.appendChild(style);
};

// `HighlightRegistry` is only partially typed in lib.dom (forEach), so narrow
// to the map methods we use.
type HighlightMap = {
  set: (name: string, highlight: Highlight) => void;
  delete: (name: string) => void;
};

const highlightRegistry = (): HighlightMap | null => {
  if (
    typeof CSS === 'undefined' ||
    !('highlights' in CSS) ||
    typeof Highlight === 'undefined'
  ) {
    return null;
  }
  return CSS.highlights as unknown as HighlightMap;
};

/**
 * Builds a DOM Range spanning character offsets `[start, end)` across the text
 * nodes inside `container`, treating the container's text content as one
 * continuous string. This matches the offset system passage annotations use
 * (offsets into the passage's concatenated text content).
 */
const rangeForOffsets = (
  container: HTMLElement,
  start: number,
  end: number,
): Range | null => {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let startNode: Text | null = null;
  let startOffset = 0;
  let endNode: Text | null = null;
  let endOffset = 0;

  let node = walker.nextNode() as Text | null;
  while (node) {
    const length = node.data.length;
    if (!startNode && consumed + length > start) {
      startNode = node;
      startOffset = start - consumed;
    }
    if (startNode && consumed + length >= end) {
      endNode = node;
      endOffset = end - consumed;
      break;
    }
    consumed += length;
    node = walker.nextNode() as Text | null;
  }

  if (!startNode || !endNode) {
    return null;
  }

  const range = document.createRange();
  try {
    range.setStart(startNode, Math.max(0, startOffset));
    range.setEnd(endNode, Math.min(endNode.data.length, endOffset));
  } catch {
    return null;
  }
  return range;
};

/**
 * Paints the character range `[start, end)` inside `container`. Replaces any
 * previously registered deep-link highlight. Returns true when the highlight
 * was applied.
 */
export const highlightTextRange = ({
  container,
  start,
  end,
}: {
  container: HTMLElement;
  start: number;
  end: number;
}): boolean => {
  const registry = highlightRegistry();
  if (
    !registry ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end <= start
  ) {
    return false;
  }

  const range = rangeForOffsets(container, start, end);
  if (!range) {
    return false;
  }

  ensureHighlightStyle();
  registry.set(HIGHLIGHT_NAME, new Highlight(range));
  return true;
};

/** Removes the deep-link highlight, if any. */
export const clearTextRangeHighlight = () => {
  highlightRegistry()?.delete(HIGHLIGHT_NAME);
};
