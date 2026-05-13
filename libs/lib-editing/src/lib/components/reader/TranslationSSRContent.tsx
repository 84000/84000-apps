import type { Extensions, JSONContent } from '@tiptap/core';
import { renderToHTMLString } from '@tiptap/static-renderer/pm/html-string';
import { translationSSRExtensions } from '../editor/extensions/translationSSRExtensions';
import { extractPlainText } from './ssr-text-fallback';

type Content = JSONContent | JSONContent[];

type Props = {
  content: Content;
  className?: string;
  extensions?: Extensions;
};

const wrapAsDoc = (content: Content): JSONContent => {
  if (Array.isArray(content)) {
    return { type: 'doc', content };
  }
  if (content?.type === 'doc') {
    return content;
  }
  return { type: 'doc', content: [content] };
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
  const known = new Set(extensions.map((e) => e.name));
  const nodeTypes = new Set<string>();
  const markTypes = new Set<string>();
  collectTypes(doc, nodeTypes, markTypes);

  const missing = [...nodeTypes, ...markTypes].filter(
    (t) => t !== 'text' && !known.has(t),
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
