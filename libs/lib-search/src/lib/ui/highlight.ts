/** Classes for a query match; the active one also carries the ring. */
export const markClassName = (isActive: boolean) =>
  isActive
    ? 'bg-accent/20 text-foreground font-semibold ring-2 ring-accent ring-offset-1 ring-offset-background rounded-sm'
    : 'bg-highlight text-foreground font-semibold';

export interface HighlightRange {
  start: number;
  end: number;
}

/**
 * Where `query` matches in `text`, left to right and without overlaps:
 * case-insensitive, and as a pattern when `useRegex` is set. An invalid
 * pattern, or an empty query, matches nothing.
 */
export const findHighlightRanges = (
  text: string,
  query: string,
  useRegex = false,
): HighlightRange[] => {
  if (!query.trim()) return [];

  let regex: RegExp;
  try {
    regex = new RegExp(
      useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'gi',
    );
  } catch {
    return [];
  }

  const ranges: HighlightRange[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match[0].length === 0) {
      regex.lastIndex++;
      continue;
    }
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }
  return ranges;
};

/**
 * Elements a passage's HTML draws that are not part of its text: folio and
 * other mentions, and endnote markers. A search match is in the text, so
 * these are neither searched nor counted.
 */
const NOT_TEXT = '.mention-container, sup.end-note-link, [type="endNoteLink"]';

/**
 * Marks the matches of `query` in a passage's rendered HTML.
 *
 * `content` is the passage's plain text, the copy search matched and that
 * `activeOccurrenceStart` is an offset into. The HTML holds more than that
 * text (folio markers, endnote numbers), so the active occurrence is found by
 * its position among the matches, not by its offset: the Nth match in
 * `content` rings the Nth match in the HTML.
 *
 * Needs a DOM, so call it in the browser. Returns the HTML unchanged when
 * there is nothing to mark.
 */
export const highlightHTML = ({
  activeOccurrenceStart,
  content,
  html,
  query,
  useRegex,
}: {
  activeOccurrenceStart?: number;
  content: string;
  html: string;
  query: string;
  useRegex?: boolean;
}): string => {
  if (!query.trim() || typeof document === 'undefined') return html;

  const template = document.createElement('template');
  template.innerHTML = html;
  const root = template.content;

  // The passage's text, as one string over its text nodes.
  const nodes: { node: Text; start: number }[] = [];
  let text = '';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest(NOT_TEXT)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const data = (node as Text).data;
    nodes.push({ node: node as Text, start: text.length });
    text += data;
  }

  const ranges = findHighlightRanges(text, query, useRegex);
  if (ranges.length === 0) return html;

  const activeIndex =
    activeOccurrenceStart == null
      ? -1
      : findHighlightRanges(content, query, useRegex).findIndex(
          (range) => range.start === activeOccurrenceStart,
        );

  // One mark per text node a match covers. Wrapped last to first, so a split
  // never moves an offset still to be wrapped: the head of a split text node
  // keeps its identity.
  const segments: {
    node: Text;
    start: number;
    end: number;
    active: boolean;
  }[] = [];
  ranges.forEach((range, index) => {
    nodes.forEach(({ node, start }) => {
      const end = start + node.data.length;
      const from = Math.max(range.start, start);
      const to = Math.min(range.end, end);
      if (from < to) {
        segments.push({
          node,
          start: from - start,
          end: to - start,
          active: index === activeIndex,
        });
      }
    });
  });

  for (let i = segments.length - 1; i >= 0; i--) {
    const { node, start, end, active } = segments[i];
    const tail = node.splitText(start);
    tail.splitText(end - start);
    const mark = document.createElement('mark');
    mark.className = markClassName(active);
    tail.replaceWith(mark);
    mark.appendChild(tail);
  }

  return template.innerHTML;
};
