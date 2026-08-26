import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Fragment, Mark, Node, Slice } from '@tiptap/pm/model';
import { v4 as uuidv4 } from 'uuid';
import {
  PARAMETER_ANNOTATION_ATTRS,
  parameterAnnotationValue,
} from '@eightyfourthousand/lib-doc-model';

/**
 * Attributes a node must not inherit from the node it was split or copied from.
 * The parameter annotations come from the shared registry, so a new one is
 * covered here without a second list to update; `hasParagraphIndent` is
 * display-only and listed on its own.
 */
const DEPENDENT_ATTR_DEFAULTS: Record<string, unknown> = {
  ...Object.fromEntries(
    PARAMETER_ANNOTATION_ATTRS.map((attr) => [attr, undefined]),
  ),
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

/**
 * Regenerates every annotation identity in a pasted slice: node uuids, mark
 * uuids, parameter-annotation uuids, mention `items[].uuid`, and endnote-link
 * `notes[].uuid`.
 *
 * Without this, pasting a copied passage leaves two passages sharing a uuid —
 * the save path collapses them into a Set and resolves the first match, so
 * the pasted passage's edits are never saved — and duplicated annotation
 * uuids upsert rows that steal `passage_uuid` from the original passage.
 *
 * Regeneration is memoized per source uuid so one logical mark split across
 * several text nodes keeps a single (new) identity. Only clipboard pastes go
 * through `transformPasted`; internal drag-moves keep their identity.
 */
export const regenerateSliceUuids = (slice: Slice): Slice => {
  const uuidMap = new Map<string, string>();
  const fresh = (old?: string | null): string => {
    if (!old) {
      return uuidv4();
    }
    let mapped = uuidMap.get(old);
    if (!mapped) {
      mapped = uuidv4();
      uuidMap.set(old, mapped);
    }
    return mapped;
  };

  const mapMarks = (marks: readonly Mark[]): Mark[] =>
    marks.map((mark) => {
      let attrs = mark.attrs;
      if (attrs.uuid != null) {
        attrs = { ...attrs, uuid: fresh(attrs.uuid as string) };
      }
      if (Array.isArray(attrs.notes)) {
        attrs = {
          ...attrs,
          notes: attrs.notes.map((note: { uuid?: string }) => ({
            ...note,
            uuid: fresh(note.uuid),
          })),
        };
      }
      return attrs === mark.attrs ? mark : mark.type.create(attrs);
    });

  const mapNode = (node: Node): Node => {
    if (node.isText) {
      return node.mark(mapMarks(node.marks));
    }

    let attrs = node.attrs;
    if (hasUuidAttr(node)) {
      attrs = { ...attrs, uuid: fresh(attrs.uuid as string | null) };
    }
    // Parameter annotations carry their identity inside an object attribute,
    // so the uuid is refreshed in place rather than on the node.
    for (const attr of PARAMETER_ANNOTATION_ATTRS) {
      const value = parameterAnnotationValue(attrs, attr);
      if (value) {
        attrs = { ...attrs, [attr]: { ...value, uuid: fresh(value.uuid) } };
      }
    }
    if (Array.isArray(attrs.items)) {
      // Mention identity lives in attrs.items[].uuid, not attrs.uuid.
      attrs = {
        ...attrs,
        items: attrs.items.map((item: { uuid?: string }) => ({
          ...item,
          uuid: fresh(item.uuid),
        })),
      };
    }
    return node.type.create(
      attrs,
      mapFragment(node.content),
      mapMarks(node.marks),
    );
  };

  const mapFragment = (fragment: Fragment): Fragment => {
    const children: Node[] = [];
    for (let i = 0; i < fragment.childCount; i++) {
      children.push(mapNode(fragment.child(i)));
    }
    return Fragment.fromArray(children);
  };

  return new Slice(mapFragment(slice.content), slice.openStart, slice.openEnd);
};

export const EnsureUniqueUuids = Extension.create({
  name: 'ensureUniqueUuids',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('ensureUniqueUuids'),
        props: {
          transformPasted: regenerateSliceUuids,
        },
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) {
            return null;
          }

          const updates: Array<{ pos: number; attrs: Record<string, unknown> }> =
            [];

          // Doc-order duplicate scan: the first occurrence of a uuid keeps
          // it; any later occurrence — adjacent or not — is regenerated.
          // transformPasted already handles pastes, so this is the safety net
          // for duplicates arriving by other routes (collab edge cases,
          // stale drops).
          const seen = new Set<string>();
          newState.doc.descendants((node, pos) => {
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

            if (seen.has(node.attrs.uuid)) {
              updates.push({
                pos,
                attrs: resetDependentAttrs(node, {
                  ...node.attrs,
                  uuid: uuidv4(),
                }),
              });
            } else {
              seen.add(node.attrs.uuid);
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
