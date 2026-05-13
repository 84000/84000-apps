import type { Extensions, JSONContent } from '@tiptap/core';
import { getSchema } from '@tiptap/core';
import { renderToHTMLString } from '@tiptap/static-renderer/pm/html-string';
import { translationSSRExtensions } from '../editor/extensions/translationSSRExtensions';
import { extractPlainText } from './ssr-text-fallback';

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

  try {
    if (process.env.NODE_ENV !== 'production') {
      assertCoverage(doc, exts);
    }
    const html = renderToHTMLString({ content: doc, extensions: exts });
    return (
      <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
    );
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
};
