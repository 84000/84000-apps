import { Transformer } from './transformer';
import { splitNode } from './split-node';
import type { TranslationEditorContentItem } from '../components/editor';

export const sort = (nodes: TranslationEditorContentItem[]) => {
  return nodes.sort((a, b) => (a.attrs?.start ?? 0) - (b.attrs?.start ?? 0));
};

export const insert = (
  node: TranslationEditorContentItem,
  nodes: TranslationEditorContentItem[],
) => {
  // unshift to prioritize new block when sorting
  nodes.unshift(node);
  return sort(nodes);
};

export const splitContentAt: Transformer = (ctx) => {
  const { root, parent, annotation, transform } = ctx;
  const { start, end } = annotation;

  if (start !== end) {
    console.warn(
      'splitContentAt: transformer expects to find an annotation with zero-length (insertion point).',
    );
    return;
  }

  if (!parent || !parent.content) {
    console.warn(
      'splitContentAt: transformer expects to find a parent block with content.',
    );
    return;
  }

  const annotationEnd = end;
  const currentContent = parent.content || [];
  const newContent = [];

  let anchored = false;
  // Whether any node ended exactly at this position, even one we skipped
  // because it wasn't text (e.g. a mention). Distinguishes "nothing was here"
  // from "the only thing here was a non-text node".
  let boundaryNonTextOnly = false;

  for (const item of currentContent) {
    const { prefix, middle, suffix } = splitNode(item, start, end);

    const lastPrefix = prefix.at(-1);
    const firstSuffix = suffix[0];

    // An end-location insertion point (e.g. an endNoteLink) attaches to the
    // text node that ends at this position. Atomic inline nodes such as
    // mentions are also zero-length and can share the boundary, but they must
    // not receive the mark — the adjacent text carries it, so the marker
    // renders before the mention rather than duplicating onto it.
    if (annotationEnd === lastPrefix?.attrs?.end) {
      if (typeof lastPrefix?.text === 'string') {
        transform?.({ root, parent, block: lastPrefix, annotation });
        anchored = true;
      } else {
        boundaryNonTextOnly = true;
      }
    } else if (annotationEnd === firstSuffix?.attrs?.end) {
      if (typeof firstSuffix?.text === 'string') {
        transform?.({ root, parent, block: firstSuffix, annotation });
        anchored = true;
      } else {
        boundaryNonTextOnly = true;
      }
    }

    newContent.push(...prefix);
    newContent.push(...middle);
    newContent.push(...suffix);
  }

  // An end-location insertion point that only ever lined up with non-text
  // nodes (and no text node) has nowhere valid to attach. This is malformed
  // data — an end marker with no preceding text in the passage — so the
  // annotation is dropped rather than rendered onto a mention.
  if (transform && !anchored && boundaryNonTextOnly) {
    console.warn(
      `splitContentAt: insertion point ${annotation.uuid} (${annotation.type}) at position ${annotationEnd} found no text node to attach to; annotation dropped.`,
    );
  }

  parent.content = newContent;
};
