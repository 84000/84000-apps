import { domOutputSpecToHTMLString } from '@tiptap/static-renderer/pm/html-string';
import type { Node as PMNode } from '@tiptap/pm/model';
import { mentionDOMOutputSpec } from './Mention.ssr';
import { mentionSpacingClass } from './mentionSpacing';

/**
 * `nodeMapping.mention` override for `renderToHTMLString`. The static renderer
 * hands each node its resolved PM `parent`, so — unlike the node's own
 * `renderHTML`, which sees no siblings — this can compute conditional spacing
 * classes and merge them onto the mention container.
 */
export const renderMentionToHTMLString = ({
  node,
  parent,
}: {
  node: PMNode;
  parent?: PMNode;
}): string => {
  let index = -1;
  // Locate the mention within its parent by identity; the renderer passes the
  // same child node instances it iterated, so `===` is reliable.
  parent?.forEach((child, _offset, i) => {
    if (child === node) index = i;
  });

  const cls =
    parent && index >= 0 ? mentionSpacingClass(node, parent, index) : '';
  const spec = mentionDOMOutputSpec(node, cls ? { class: cls } : {});
  return domOutputSpecToHTMLString(spec)([]);
};
