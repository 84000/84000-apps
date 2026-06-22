import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Node } from '@tiptap/pm/model';
import { v4 as uuidv4 } from 'uuid';

const DEPENDENT_ATTR_DEFAULTS: Record<string, unknown> = {
  leadingSpaceUuid: null,
  hasLeadingSpace: false,
  indentUuid: null,
  hasIndent: false,
  hasParagraphIndent: false,
};

const hasUuidAttr = (node: Node) =>
  Object.prototype.hasOwnProperty.call(node.type.spec.attrs ?? {}, 'uuid');

const resetDependentAttrs = (node: Node, base: Record<string, unknown>) => {
  const attrs = { ...base };
  const schemaAttrs = node.type.spec.attrs ?? {};
  for (const key of Object.keys(DEPENDENT_ATTR_DEFAULTS)) {
    if (Object.prototype.hasOwnProperty.call(schemaAttrs, key)) {
      attrs[key] = DEPENDENT_ATTR_DEFAULTS[key];
    }
  }
  return attrs;
};

export const EnsureUniqueUuids = Extension.create({
  name: 'ensureUniqueUuids',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('ensureUniqueUuids'),
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) {
            return null;
          }

          const updates: Array<{ pos: number; attrs: Record<string, unknown> }> =
            [];

          newState.doc.descendants((node, pos, parent, index) => {
            if (!hasUuidAttr(node)) {
              return true;
            }

            if (!node.attrs.uuid) {
              updates.push({
                pos,
                attrs: { ...node.attrs, uuid: uuidv4() },
              });
              return true;
            }

            if (
              parent &&
              index > 0 &&
              parent.child(index - 1).attrs.uuid === node.attrs.uuid
            ) {
              updates.push({
                pos,
                attrs: resetDependentAttrs(node, {
                  ...node.attrs,
                  uuid: uuidv4(),
                }),
              });
            }

            return true;
          });

          if (updates.length === 0) {
            return null;
          }

          const tr = newState.tr;
          // Apply in reverse document order so an earlier (lower) position is
          // never invalidated by a later edit that changes document size — e.g.
          // rebuilding a leaf node (an inline atom such as a mention) whose new
          // markup does not "fit trivially" and shifts subsequent positions.
          // Re-resolve each node at apply time and skip it if the position no
          // longer points at a uuid-bearing, non-text node; the plugin must
          // never throw, and a skipped node is reconciled on the next cycle.
          for (const { pos, attrs } of [...updates].reverse()) {
            const node = tr.doc.nodeAt(pos);
            if (!node || node.isText || !hasUuidAttr(node)) {
              continue;
            }
            tr.setNodeMarkup(pos, undefined, attrs);
          }
          return tr.docChanged ? tr : null;
        },
      }),
    ];
  },
});

export default EnsureUniqueUuids;
