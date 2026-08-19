import type { Node as PMNode } from '@tiptap/pm/model';
import { escapeHtml } from '@eightyfourthousand/lib-utils';

import {
  hasItalicizingMark,
  UPRIGHT_PIPE_CLASS,
  UPRIGHT_PIPE_STYLE,
} from './italicizingMarks';

/**
 * `nodeMapping.text` override for `renderToHTMLString`, wrapping every `|` in
 * italicised text so the danda stays upright.
 *
 * `PipeNotItalic` expresses the same rule as ProseMirror decorations, which
 * exist only where there is an EditorView. The readers serialise statically,
 * so without this the dandas render italic there (ED-1458).
 *
 * The renderer hands this the text node with its marks still attached and
 * wraps the result in them afterwards, so the marks are readable here. It also
 * escapes text itself, but only in the default `text` handler this replaces,
 * so escaping happens here instead.
 */
export const renderTextToHTMLString = ({ node }: { node: PMNode }): string => {
  const text = node.text ?? '';

  if (!text.includes('|') || !hasItalicizingMark(node.marks)) {
    return escapeHtml(text);
  }

  // Splitting on the pipe covers runs like `||` too: the empty string between
  // two pipes rejoins as a second wrapped separator.
  return text
    .split('|')
    .map(escapeHtml)
    .join(
      `<span class="${UPRIGHT_PIPE_CLASS}" style="${UPRIGHT_PIPE_STYLE}">|</span>`,
    );
};
