import { searchablePosition, searchableText, normalizeForm } from './text';

/**
 * Finds `text` in a passage's stored content and returns its stored range.
 * Reviewers name a span by its text, never by an offset in a rendering of the
 * passage, so this is how such a span reaches a write. Pure.
 *
 * Soft hyphens and runs of whitespace are ignored when comparing. With
 * `occurrence` (1-based) it takes that occurrence; otherwise the one nearest
 * `near` (a stored offset), or the first. An exact-case occurrence is preferred
 * over a case-insensitive one. Returns null when the text is not there.
 */
export const reanchorText = ({
  content,
  text,
  occurrence,
  near,
}: {
  content: string;
  text: string;
  occurrence?: number;
  near?: number;
}): { start: number; end: number } | null => {
  const wanted = normalizeForm(text);
  if (!wanted) return null;
  const searchable = searchableText(content);
  const pattern = wanted
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/ /g, '\\s+');

  const find = (flags: string) => {
    const found: { start: number; end: number }[] = [];
    const regex = new RegExp(pattern, flags);
    let m: RegExpExecArray | null;
    while ((m = regex.exec(searchable.text))) {
      found.push({ start: m.index, end: m.index + m[0].length });
      regex.lastIndex =
        m.index +
        ((searchable.text.codePointAt(m.index) ?? 0) > 0xffff ? 2 : 1);
    }
    return found;
  };
  let found = find('gu');
  if (!found.length) found = find('giu');
  if (!found.length) return null;

  let chosen = found[0];
  if (occurrence !== undefined) {
    if (occurrence < 1 || occurrence > found.length) return null;
    chosen = found[occurrence - 1];
  } else if (near !== undefined) {
    const at = searchablePosition(searchable, near);
    chosen = found.reduce((best, f) =>
      Math.abs(f.start - at) < Math.abs(best.start - at) ? f : best,
    );
  }
  return {
    start: searchable.stored[chosen.start],
    end: searchable.stored[chosen.end - 1] + 1,
  };
};
