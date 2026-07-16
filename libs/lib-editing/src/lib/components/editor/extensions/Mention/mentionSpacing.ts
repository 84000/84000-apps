import type { Node as PMNode } from '@tiptap/pm/model';

/**
 * Conditional visual spacing around mention nodes. A mention is an inline atom;
 * when it sits flush against a letter it reads as cramped. These helpers decide
 * whether to render the visual equivalent of a single space on either side.
 *
 * Rules (asymmetric by design):
 *  - Leading side: add a gap when preceded by any visible character —
 *    punctuation included. Only whitespace (or the block start) suppresses it.
 *  - Trailing side: add a gap only when followed by a non-whitespace,
 *    non-punctuation character.
 * Two directly adjacent mentions get exactly one gap between them. The gap is
 * purely presentational (a CSS pseudo-element renders a real space) — the
 * document content is untouched.
 */

export const MENTION_SPACE_BEFORE_CLASS = 'mention-space-before';
export const MENTION_SPACE_AFTER_CLASS = 'mention-space-after';

// `\p{P}` covers Latin punctuation, CJK marks, quotes/brackets, and the Tibetan
// tsheg (U+0F0B) and shad (U+0F0D). Punctuation suppresses only the trailing
// gap; the leading gap keys off whitespace alone.
const BOUNDARY_CHAR = /[\s\p{P}]/u;
const WHITESPACE_CHAR = /\s/u;

/** A mention with no resolvable label renders empty; it needs no spacing. */
const hasVisibleText = (node: PMNode): boolean =>
  (Array.isArray(node.attrs.items) ? node.attrs.items : []).some(
    (item: { text?: string; displayText?: string } | null) =>
      !!(item && (item.text || item.displayText)),
  );

/** Text content of a sibling — empty for atoms/breaks (treated as no char). */
const siblingText = (node: PMNode): string =>
  node.isText ? node.text ?? '' : node.textContent;

const firstCodePoint = (text: string): string =>
  text ? String.fromCodePoint(text.codePointAt(0) as number) : '';

const lastCodePoint = (text: string): string => {
  if (!text) return '';
  const points = Array.from(text);
  return points[points.length - 1] ?? '';
};

/** Should the mention render a gap toward the node preceding it? */
const gapBefore = (prev: PMNode | null | undefined): boolean => {
  if (!prev) return false;
  // The preceding mention owns the single gap between the two (via its
  // `after` side), so this mention adds nothing on its `before` side.
  if (prev.type.name === 'mention') return false;
  // Leading gap keys off whitespace only — punctuation before a mention still
  // gets a space.
  const char = lastCodePoint(siblingText(prev));
  return !!char && !WHITESPACE_CHAR.test(char);
};

/** Should the mention render a gap toward the node following it? */
const gapAfter = (next: PMNode | null | undefined): boolean => {
  if (!next) return false;
  // Emit the single gap between two adjacent mentions from the earlier one.
  if (next.type.name === 'mention') return true;
  // Trailing gap suppressed next to both whitespace and punctuation.
  const char = firstCodePoint(siblingText(next));
  return !!char && !BOUNDARY_CHAR.test(char);
};

/**
 * The spacing class string for a mention at `index` within `parent`.
 * Returns '' (no spacing), one class, or both, space-separated.
 */
export const mentionSpacingClass = (
  node: PMNode,
  parent: PMNode,
  index: number,
): string => {
  if (!hasVisibleText(node)) return '';
  const classes: string[] = [];
  if (gapBefore(parent.maybeChild(index - 1))) {
    classes.push(MENTION_SPACE_BEFORE_CLASS);
  }
  if (gapAfter(parent.maybeChild(index + 1))) {
    classes.push(MENTION_SPACE_AFTER_CLASS);
  }
  return classes.join(' ');
};
