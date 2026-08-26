import type { Node } from '@tiptap/pm/model';
import type { TranslationEditorContentItem } from '@eightyfourthousand/data-access';

/** Concatenated text of a block tree, the way `Node.textContent` reports it. */
export const collectText = (item: TranslationEditorContentItem): string => {
  if (item.type === 'text') {
    return item.text ?? '';
  }
  return (item.content ?? []).map(collectText).join('');
};

/**
 * Stamps a uuid on every non-text node that lacks one, the way `ensureUuids()`
 * does in the editor before a save.
 *
 * The exporters skip a node with no `uuid`, and some nodes are built without
 * one because their identity lives elsewhere — a `mention` keeps it in
 * `items[].uuid`. Exporting a freshly transformed block without this step
 * drops those nodes, which is a property of the fixture, not of the exporters.
 */
export const stampNodeUuids = (
  item: TranslationEditorContentItem,
  counter = { next: 1 },
): TranslationEditorContentItem => {
  if (item.type && item.type !== 'text' && !item.attrs?.uuid) {
    item.attrs = { ...item.attrs, uuid: `node-uuid-${counter.next++}` };
  }
  (item.content ?? []).forEach((child) => stampNodeUuids(child, counter));
  return item;
};

/**
 * Wraps a JSON block tree in just enough ProseMirror `Node` shape for the
 * exporters to read.
 *
 * The exporters only ever touch `type.name`, `attrs`, `marks`, `textContent`
 * and `content`, so a real schema is unnecessary — and using one would make the
 * test depend on which attributes that schema happens to declare, which is the
 * very thing the exporters must not assume.
 */
export const toFakeNode = (item: TranslationEditorContentItem): Node => {
  const children = (item.content ?? []).map(toFakeNode);
  return {
    type: { name: item.type ?? 'unknown' },
    attrs: item.attrs ?? {},
    marks: (item.marks ?? []).map((mark) => ({
      type: { name: mark.type },
      attrs: mark.attrs ?? {},
    })),
    isText: item.type === 'text',
    text: item.text,
    textContent: collectText(item),
    content: {
      size: children.length,
      childCount: children.length,
      child: (i: number) => children[i],
      forEach: (cb: (child: Node) => void) => children.forEach(cb),
    },
  } as unknown as Node;
};
