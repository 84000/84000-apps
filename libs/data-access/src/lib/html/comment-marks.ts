/** Where one comment mark sits in an HTML fragment. */
export interface HtmlCommentAnchor {
  /** The mark's own identity. */
  uuid: string;
  /** The thread root the mark points at. */
  comment: string;
  /** Text offsets `[start, end)`, markup excluded. */
  start: number;
  end: number;
}

/** One tag, with its attributes; quoted values may hold `>`. */
const TAG =
  /<(\/?)([a-zA-Z][^\s/>]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>/g;

/** An entity counts as the one character it stands for. */
const textLength = (text: string) =>
  text.replace(/&(?:#\d+|#x[\da-f]+|[a-z\d]+);/gi, '_').length;

const attribute = (attributes: string, name: string): string | undefined => {
  const match = attributes.match(
    new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`),
  );
  return match ? (match[1] ?? match[2] ?? match[3]) : undefined;
};

type Token =
  | { kind: 'text'; text: string }
  | { kind: 'open' | 'close' | 'other'; tag: string; attributes: string };

function* tokens(html: string): Generator<Token> {
  let last = 0;
  for (const match of html.matchAll(TAG)) {
    const index = match.index ?? 0;
    if (index > last) yield { kind: 'text', text: html.slice(last, index) };
    last = index + match[0].length;

    const [tag, slash, name, attributes] = match;
    const kind =
      name.toLowerCase() !== 'span' ? 'other' : slash ? 'close' : 'open';
    yield { kind, tag, attributes };
  }
  if (last < html.length) yield { kind: 'text', text: html.slice(last) };
}

const isCommentSpan = (attributes: string) =>
  attribute(attributes, 'type') === 'comment';

/** Whether a fragment might hold a comment mark. Cheap; may be wrong-positive. */
const mayHoldCommentMarks = (html: string) => html.includes('comment');

/**
 * Every comment mark in an HTML fragment, in document order.
 *
 * A mark split by other inline markup arrives as several spans, each its own
 * anchor; adjacent ones share an end and a start.
 */
export const commentAnchorsInHtml = (html: string): HtmlCommentAnchor[] => {
  if (!mayHoldCommentMarks(html)) return [];

  const anchors: HtmlCommentAnchor[] = [];
  const open: (HtmlCommentAnchor | null)[] = [];
  let position = 0;

  for (const token of tokens(html)) {
    if (token.kind === 'text') {
      position += textLength(token.text);
    } else if (token.kind === 'open') {
      const comment = isCommentSpan(token.attributes)
        ? attribute(token.attributes, 'comment')
        : undefined;
      open.push(
        comment
          ? {
              uuid: attribute(token.attributes, 'uuid') ?? '',
              comment,
              start: position,
              end: position,
            }
          : null,
      );
    } else if (token.kind === 'close') {
      const anchor = open.pop();
      if (anchor) anchors.push({ ...anchor, end: position });
    }
  }

  return anchors.sort((a, b) => a.start - b.start);
};

/**
 * An HTML fragment with its comment marks unwrapped, keeping the text they
 * cover. For anything leaving the editor: comments are draft-only.
 */
export const stripCommentMarks = (html: string): string => {
  if (!mayHoldCommentMarks(html)) return html;

  let out = '';
  const open: boolean[] = [];

  for (const token of tokens(html)) {
    if (token.kind === 'text') {
      out += token.text;
    } else if (token.kind === 'open') {
      const comment = isCommentSpan(token.attributes);
      open.push(comment);
      if (!comment) out += token.tag;
    } else if (token.kind === 'close') {
      if (!open.pop()) out += token.tag;
    } else {
      out += token.tag;
    }
  }

  return out;
};
