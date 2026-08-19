import type { Mark } from '@tiptap/pm/model';

/**
 * The design system italicises any element carrying a `lang` attribute apart
 * from these four (`[lang]:not([lang='en'], [lang='bo'], [lang='ja'],
 * [lang='zh'])` in `components.css`). `foreign` and `mantra` both render a
 * `lang`, so their text comes out italic without ever carrying an italic mark.
 * Keep this list in step with that rule.
 */
export const UPRIGHT_LANGS = new Set(['en', 'bo', 'ja', 'zh']);

/**
 * Whether a mark renders its text in italics — either because it is the italic
 * mark itself, or because the `lang` it renders trips the rule above.
 *
 * Takes the name and attributes rather than a mark so that both callers can
 * use it: the ProseMirror plugin holds `Mark` instances, while the static
 * renderer's node mapping sees whatever the schema handed it.
 */
export const isItalicizingMark = (
  name: string,
  attrs?: Record<string, unknown> | null,
): boolean => {
  if (name === 'italic' || name === 'em') {
    return true;
  }

  const lang = attrs?.lang;
  return typeof lang === 'string' && !UPRIGHT_LANGS.has(lang);
};

export const hasItalicizingMark = (marks: readonly Mark[]): boolean =>
  marks.some((mark) => isItalicizingMark(mark.type.name, mark.attrs));

/**
 * Applied to each `|` so it stays upright inside italic text. The class is the
 * themable hook; the inline style is what actually guarantees the result,
 * since the three apps that render translations build their CSS separately and
 * a Tailwind utility is only present where that app's build emitted it.
 */
export const UPRIGHT_PIPE_CLASS = 'not-italic';
export const UPRIGHT_PIPE_STYLE = 'font-style:normal';
