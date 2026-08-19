import type { Extensions, JSONContent } from '@tiptap/core';
import { getSchema } from '@tiptap/core';
import { renderToHTMLString } from '@tiptap/static-renderer/pm/html-string';
import {
  cn,
  escapeHtml,
  escapeHtmlAttribute,
} from '@eightyfourthousand/lib-utils';
import { translationSSRExtensions } from '../editor/extensions/translationSSRExtensions';
import { renderMentionToHTMLString } from '../editor/extensions/Mention/mentionSSRMapping';
import { renderTextToHTMLString } from '../editor/extensions/PipeNotItalic';
import { extractPlainText } from './ssr-text-fallback';

type EndNoteItem = {
  uuid: string;
  endNote: string;
  location?: string;
  toh?: string;
  label?: string;
};

const isEndNoteItem = (value: unknown): value is EndNoteItem => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.uuid === 'string' && typeof v.endNote === 'string';
};

const renderEndNoteLinkMark = ({
  mark,
  children,
}: {
  mark: { attrs: Record<string, unknown> };
  children?: string | string[];
}): string => {
  const raw = mark.attrs.notes;
  const notes: EndNoteItem[] = Array.isArray(raw)
    ? // Skip orphaned references: an endnote-link whose target passage no
      // longer exists has no resolvable label. Rendering it would leave a
      // stray marker in the reader, so drop it. The editor keeps showing "*".
      raw.filter(isEndNoteItem).filter((note) => note.label)
    : [];
  notes.sort((a, b) => (a.label || '').localeCompare(b.label || ''));

  const supHtml = (n: EndNoteItem, marginClass: string) => {
    const cls = cn('end-note-link', marginClass);
    const tohAttr = n.toh ? ` data-toh="${escapeHtmlAttribute(n.toh)}"` : '';
    const itemLabel = escapeHtml(n.label?.split('.').pop() || '');
    // Glue the marker to the text it's attached to with a word joiner (U+2060)
    // so it never wraps to a new line away from its content: after the text for
    // start notes, before it for end notes.
    const joined =
      n.location === 'start' ? `${itemLabel}⁠` : `⁠${itemLabel}`;
    return (
      `<sup class="${escapeHtmlAttribute(cls)}"` +
      tohAttr +
      ` type="endNoteLink"` +
      ` endNote="${escapeHtmlAttribute(n.endNote)}"` +
      ` uuid="${escapeHtmlAttribute(n.uuid)}">` +
      `${joined}</sup>`
    );
  };

  const start = notes
    .filter((n) => n.location === 'start')
    .map((n) => supHtml(n, 'me-0.75'))
    .join('');
  const end = notes
    .filter((n) => n.location !== 'start')
    .map((n) => supHtml(n, ''))
    .join('');
  const body = ([] as unknown[]).concat(children ?? '').filter(Boolean).join('');

  return `<span>${start}${body}${end}</span>`;
};

type Content = JSONContent | JSONContent[];

type Props = {
  content: Content;
  className?: string;
  extensions?: Extensions;
};

const TOP_NODE_NAME = 'doc';
const TOP_NODE_ALIASES = new Set([TOP_NODE_NAME, 'translation']);
const BUILTIN_TYPES = new Set([TOP_NODE_NAME, 'text']);

const wrapAsDoc = (content: Content): JSONContent => {
  if (Array.isArray(content)) {
    return { type: TOP_NODE_NAME, content };
  }
  if (content?.type && TOP_NODE_ALIASES.has(content.type)) {
    return { type: TOP_NODE_NAME, content: content.content ?? [] };
  }
  return { type: TOP_NODE_NAME, content: [content] };
};

const collectTypes = (
  node: JSONContent,
  nodeTypes: Set<string>,
  markTypes: Set<string>,
) => {
  if (node.type) nodeTypes.add(node.type);
  for (const mark of node.marks ?? []) {
    if (mark.type) markTypes.add(mark.type);
  }
  for (const child of node.content ?? []) {
    collectTypes(child, nodeTypes, markTypes);
  }
};

const assertCoverage = (doc: JSONContent, extensions: Extensions) => {
  // Resolve bundles like StarterKit into their constituent node/mark specs so
  // the coverage check sees blockquote, code, hardBreak, etc. that are
  // registered indirectly.
  const schema = getSchema(extensions);
  const known = new Set([
    ...Object.keys(schema.nodes),
    ...Object.keys(schema.marks),
  ]);
  const nodeTypes = new Set<string>();
  const markTypes = new Set<string>();
  collectTypes(doc, nodeTypes, markTypes);

  const missing = [...nodeTypes, ...markTypes].filter(
    (t) => !BUILTIN_TYPES.has(t) && !known.has(t),
  );

  if (missing.length > 0) {
    throw new Error(
      `[TranslationSSRContent] SSR extension coverage is incomplete; missing: ${missing.join(', ')}`,
    );
  }
};

export const TranslationSSRContent = ({
  content,
  className,
  extensions,
}: Props) => {
  const exts = extensions ?? translationSSRExtensions;
  const doc = wrapAsDoc(content);

  // Only the serialization can fail, so that is all the try covers. Keeping the
  // JSX outside it satisfies the rule and is more honest besides: constructing
  // an element never throws, so wrapping it never caught anything.
  let html: string;
  try {
    if (process.env.NODE_ENV !== 'production') {
      assertCoverage(doc, exts);
    }
    html = renderToHTMLString({
      content: doc,
      extensions: exts,
      options: {
        markMapping: { endNoteLink: renderEndNoteLinkMark },
        nodeMapping: {
          mention: renderMentionToHTMLString,
          text: renderTextToHTMLString,
        },
      },
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      throw err;
    }
    console.error(
      '[TranslationSSRContent] SSR render failed; using text fallback',
      err,
    );
    return <div className={className}>{extractPlainText(doc)}</div>;
  }

  return (
    <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
};
