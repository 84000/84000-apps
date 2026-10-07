import { getSchema, type JSONContent } from '@tiptap/core';
import { MarkdownManager } from '@tiptap/markdown';
import { Node as PMNode, type Schema } from '@tiptap/pm/model';
import { createMarkdownExtensions } from './markdown-extensions';

/**
 * Markdown parse/serialize over the markdown-safe subset, plus the fidelity
 * guard: edit richly only what round-trips byte for byte, and never write an
 * unchanged document.
 */

/**
 * Which text the encoder escapes fully: none, the text nodes of the blocks
 * that need it, or all.
 */
type Escaping = ReadonlySet<JSONContent> | 'all' | null;

type Codec = {
  schema: Schema;
  manager: MarkdownManager;
  escaping: Escaping;
};

let codec: Codec | undefined;

/** Built on first use, so importing the library does no markdown work. */
const getCodec = (): Codec => {
  if (!codec) {
    const extensions = createMarkdownExtensions();
    const state: Codec = {
      schema: getSchema(extensions),
      manager: new MarkdownManager({ extensions }),
      escaping: null,
    };
    overrideEncoder(state);
    codec = state;
  }
  return codec;
};

/**
 * Upstream entity-encodes every `&`, `<` and `>` in text, so "Tibetan &
 * Sanskrit" can never round-trip. This replaces that private method on our
 * instance (`markdown-codec.spec.ts` fails if it disappears) with an encoder
 * that, by default, escapes only what always changes meaning: `<`, an `&`
 * that starts an entity, and `>` that starts a line. `serializeMarkdown`
 * escapes fully the text that needs it (`state.escaping`).
 */
const overrideEncoder = (state: Codec) => {
  const target = state.manager as unknown as EncoderTarget;
  if (typeof target.encodeTextForMarkdown !== 'function' || !target.codeTypes) {
    return;
  }
  const codeTypes = target.codeTypes;
  target.encodeTextForMarkdown = (text, node, parent) => {
    const inCode =
      (parent?.type !== undefined && codeTypes.has(parent.type)) ||
      (node.marks ?? []).some((mark) => codeTypes.has(mark.type));
    if (inCode) {
      return text;
    }
    const { escaping } = state;
    const all = escaping === 'all' || (escaping?.has(node) ?? false);
    return encodeText(
      all ? escapeMarkup(text, parent?.content?.[0] === node) : text,
    );
  };
};

/** Internal: the private upstream members the encoder override relies on. */
export type EncoderTarget = {
  encodeTextForMarkdown?: (
    text: string,
    node: JSONContent,
    parent?: JSONContent,
  ) => string;
  codeTypes?: Set<string>;
};

/** Backslash-escapes whatever in `text` could read as markdown syntax. */
const escapeMarkup = (text: string, first: boolean) =>
  text
    // A backslash before punctuation, a line break or the next node.
    .replace(/\\(?=[!-/:-@[-`{-~]|\n|$)/g, '\\\\')
    .replace(/[*_`[\]~|>@]/g, '\\$&')
    // A heading's closing sequence.
    .replace(/(^|[ \t])#(?=#*[ \t]*(\n|$))/g, '$1\\#')
    .replace(/(^|\n)([ \t]*)([#+=-])/g, '$1$2\\$3')
    .replace(/(^|\n)([ \t]*\d+)([.)])/g, '$1$2\\$3')
    // Upstream's ordered-list tokenizer also cuts a paragraph after its first
    // character: its `start`, `/^(\s*)(\d+)\.\s+/`, is tried on the text
    // after it (`A1. Scope`, `x 10.` before a newline). The rule above covers
    // the starts of lines. Only the first text node of a block: a later one
    // follows another inline node, not the start of a paragraph.
    .replace(first ? /^([^\n])(\s*\d+)\.(?=\s|$)/ : /(?!)/, '$1$2\\.')
    // `!` before a link would make it an image.
    .replace(/!$/, '\\!')
    // GFM autolink literals: `scheme://`, `www.` and (above) `@`.
    .replace(/:(?=\/\/)/g, '\\:')
    .replace(/(^|[^\w])www\./g, '$1www\\.');

const encodeText = (text: string) =>
  text
    .replace(/&(?=#?\w+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/(^|\n)>/g, '$1&gt;');

const BOM = '\uFEFF';

/**
 * Parse markdown into a document of the markdown subset's schema. Throws if
 * the parser produces something the schema cannot hold, e.g. an image.
 */
export const parseMarkdown = (markdown: string): JSONContent => {
  const { manager, schema } = getCodec();
  const json = manager.parse(markdown.replace(/^\uFEFF/, ''));
  if (!json.content?.length) {
    json.content = [{ type: 'paragraph' }];
  }
  const node = PMNode.fromJSON(schema, json);
  node.check();
  return node.toJSON();
};

/** How a serialized document should begin, end and break its lines. */
export type MarkdownFormat = {
  /** Start with a byte order mark. Default: false. */
  byteOrderMark?: boolean;
  /** Appended after the last block. Default: none. */
  endOfFile?: string;
  /** Line ending to emit. Default: `\n`. */
  lineEnding?: '\n' | '\r\n';
};

const render = (doc: JSONContent, escaping: Escaping) => {
  const state = getCodec();
  state.escaping = escaping;
  try {
    return state.manager.serialize(doc).replace(/\n+$/, '');
  } finally {
    state.escaping = null;
  }
};

// Trailing empty paragraphs are not written, so they do not count.
const withoutTrailingEmpty = (doc: JSONContent): JSONContent => {
  const content = [...(doc.content ?? [])];
  const isEmpty = (node?: JSONContent) =>
    node?.type === 'paragraph' && !node.content?.length;
  while (content.length > 1 && isEmpty(content.at(-1))) {
    content.pop();
  }
  return { ...doc, content };
};

/** Adds the byte order mark, end-of-file newlines and line endings. */
const finish = (
  body: string,
  { byteOrderMark, endOfFile, lineEnding }: Required<MarkdownFormat>,
) => {
  const text = (byteOrderMark ? BOM : '') + body + endOfFile;
  return lineEnding === '\n' ? text : text.replace(/\n/g, '\r\n');
};

/**
 * True when `markdown`, exactly as it would be written, parses back to `doc`.
 * Trailing empty paragraphs count on neither side. Never throws: markdown
 * that cannot be parsed back is not exact.
 */
const parsesBackTo = (markdown: string, doc: JSONContent) => {
  const { schema } = getCodec();
  try {
    const parsed = withoutTrailingEmpty(parseMarkdown(markdown));
    return PMNode.fromJSON(schema, parsed).eq(
      PMNode.fromJSON(schema, withoutTrailingEmpty(doc)),
    );
  } catch {
    return false;
  }
};

const addTextNodes = (node: JSONContent, into: Set<JSONContent>) => {
  if (node.type === 'text') {
    into.add(node);
  }
  node.content?.forEach((child) => addTextNodes(child, into));
};

/**
 * The text nodes of the top-level blocks that do not round-trip alone. Each
 * is checked followed by a newline, as every block but the last is.
 */
const textNeedingEscapes = (
  doc: JSONContent,
  format: Required<MarkdownFormat>,
) => {
  const nodes = new Set<JSONContent>();
  const followed = { ...format, endOfFile: '\n' };
  for (const block of doc.content ?? []) {
    const alone = { ...doc, content: [block] };
    if (!parsesBackTo(finish(render(alone, null), followed), alone)) {
      addTextNodes(block, nodes);
    }
  }
  return nodes;
};

/** A serialized document, and whether it parses back to the same one. */
export type SerializedMarkdown = {
  markdown: string;
  /**
   * True when `markdown` parses back to the serialized document. When false,
   * saving it would change the document on reload: do not save it.
   */
  exact: boolean;
};

/**
 * Serialize a markdown-subset document to markdown. Text is escaped only as
 * far as it must be for the markdown to parse back to the same document:
 * first not at all, then in the top-level blocks that need it, then
 * everywhere. Some documents have no exact markdown, e.g. an empty
 * blockquote or a backtick inside inline code; for those `exact` is false.
 */
export const serializeMarkdown = (
  doc: JSONContent,
  {
    byteOrderMark = false,
    endOfFile = '',
    lineEnding = '\n',
  }: MarkdownFormat = {},
): SerializedMarkdown => {
  const format = { byteOrderMark, endOfFile, lineEnding };
  // Not written, so an Enter at the end changes nothing.
  const written = withoutTrailingEmpty(doc);
  // Exactness is a property of the bytes written, so it is checked on them:
  // an end-of-file newline can change how the last block parses.
  const write = (escaping: Escaping): SerializedMarkdown => {
    const markdown = finish(render(written, escaping), format);
    return { markdown, exact: parsesBackTo(markdown, written) };
  };
  let result = write(null);
  if (!result.exact) {
    const blocks = textNeedingEscapes(written, format);
    if (blocks.size) {
      result = write(blocks);
    }
  }
  if (!result.exact) {
    const all = write('all');
    if (all.exact) {
      result = all;
    }
  }
  return result;
};

/**
 * True when a source has a carriage return outside uniform CRLF line endings:
 * mixed endings or a lone CR. No serialization can keep those.
 */
export const hasIrregularLineEndings = (source: string): boolean =>
  /\r(?!\n)/.test(source) ||
  (source.includes('\r\n') && /(^|[^\r])\n/.test(source));

/**
 * The formatting a source's serialization should keep: a byte order mark, its
 * end-of-file newlines and, when every line ends in CRLF, CRLF. None of them
 * is visible in the editor, so keeping them is the serializer's job.
 */
export const markdownFormatOf = (source: string): Required<MarkdownFormat> => {
  const crlf = source.includes('\r\n') && !/(^|[^\r])\n/.test(source);
  const endOfFile = /\n*$/.exec(source.replace(/\r\n/g, '\n'))?.[0] ?? '';
  return {
    byteOrderMark: source.startsWith(BOM),
    endOfFile,
    lineEnding: crlf ? '\r\n' : '\n',
  };
};

/** Why a source cannot be edited richly. */
export type MarkdownFallbackReason =
  | 'line-endings'
  | 'unsupported'
  | 'not-identical';

/** The result of round-tripping a source through the markdown subset. */
export type MarkdownRoundTrip =
  | {
      /** The source survives byte for byte: `serialized === source`. */
      ok: true;
      serialized: string;
      /** The parsed document, to load into an editor. */
      doc: JSONContent;
    }
  | {
      ok: false;
      reason: MarkdownFallbackReason;
      /**
       * The source after parse and serialize, or `null` when it could not be
       * parsed into the subset (always for `unsupported`).
       */
      serialized: string | null;
      /** The parsed document, or `null` when it could not be parsed. */
      doc: JSONContent | null;
    };

/**
 * Parse and re-serialize `source`. `ok` is a strict, byte-for-byte equality:
 * no whitespace or line-ending normalisation. A source that is not `ok` must
 * not be edited richly, or saving it would silently reformat it. Never
 * throws: a source the subset cannot hold is `unsupported`.
 */
export const checkMarkdownRoundTrip = (source: string): MarkdownRoundTrip => {
  let parsed: { doc: JSONContent; serialized: string } | null = null;
  try {
    const doc = parseMarkdown(source);
    const { markdown } = serializeMarkdown(doc, markdownFormatOf(source));
    parsed = { doc, serialized: markdown };
  } catch {
    // Unsupported by the subset, unless the line endings rule it out first.
  }
  if (hasIrregularLineEndings(source)) {
    return {
      ok: false,
      reason: 'line-endings',
      serialized: parsed?.serialized ?? null,
      doc: parsed?.doc ?? null,
    };
  }
  if (!parsed) {
    return { ok: false, reason: 'unsupported', serialized: null, doc: null };
  }
  const { doc, serialized } = parsed;
  return serialized === source
    ? { ok: true, serialized, doc }
    : { ok: false, reason: 'not-identical', serialized, doc };
};

/**
 * The save gate: true only when `serialized` differs from the loaded source,
 * byte for byte. Never write when this is false.
 */
export const hasMarkdownChanges = (
  serialized: string,
  source: string,
): boolean => serialized !== source;
