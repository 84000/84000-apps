import type { JSONContent } from '@tiptap/core';
import { v4 as uuidv4 } from 'uuid';

import {
  PARAMETER_ANNOTATION_ATTRS,
  parameterAnnotationValue,
} from './annotation-attrs';

type Attrs = Record<string, unknown>;
type Identified = { uuid?: string };

/** Attributes a block must not inherit from the block it was split from. */
const DEPENDENT_ATTRS = [...PARAMETER_ANNOTATION_ATTRS, 'hasParagraphIndent'];

const identities = (item: JSONContent, into: Set<string>): Set<string> => {
  const add = (attrs?: Attrs) => {
    if (!attrs) return;
    if (typeof attrs.uuid === 'string') into.add(attrs.uuid);
    for (const attr of PARAMETER_ANNOTATION_ATTRS) {
      const value = parameterAnnotationValue(attrs, attr);
      if (value) into.add(value.uuid);
    }
    for (const key of ['items', 'notes']) {
      const list = attrs[key];
      if (Array.isArray(list)) {
        (list as Identified[]).forEach((entry) => {
          if (entry?.uuid) into.add(entry.uuid);
        });
      }
    }
  };
  add(item.attrs);
  item.marks?.forEach((mark) => add(mark.attrs));
  item.content?.forEach((child) => identities(child, into));
  return into;
};

/**
 * The tail of a split, with every identity it shares with the head replaced.
 *
 * Cutting a document mid-block leaves both halves with the block's uuid and
 * its parameter annotations, and a mark across the cut on both sides of it.
 * Saved that way, the tail's rows take the head's primary keys and move its
 * annotations to the new passage. The head keeps its identities; a block the
 * tail duplicates also drops its dependent attributes, as `EnsureUniqueUuids`
 * does for a split inside one editor.
 */
export const withFreshSplitIdentities = (
  head: JSONContent,
  tail: JSONContent,
): JSONContent => {
  const taken = identities(head, new Set());
  const replaced = new Map<string, string>();
  // One mark over several text nodes keeps one identity, just a new one.
  const fresh = (uuid: string) => {
    let next = replaced.get(uuid);
    if (!next) {
      next = uuidv4();
      replaced.set(uuid, next);
    }
    return next;
  };
  const renew = (list: unknown) =>
    Array.isArray(list)
      ? (list as Identified[]).map((entry) =>
          entry?.uuid && taken.has(entry.uuid)
            ? { ...entry, uuid: fresh(entry.uuid) }
            : entry,
        )
      : list;

  const visitAttrs = (attrs: Attrs, isNode: boolean): Attrs => {
    let next = { ...attrs };
    const uuid = attrs.uuid;
    if (typeof uuid === 'string' && taken.has(uuid)) {
      if (isNode) {
        next = { ...next, uuid: uuidv4() };
        // Deleted, so the schema's defaults apply.
        DEPENDENT_ATTRS.forEach((attr) => delete next[attr]);
      } else {
        next = { ...next, uuid: fresh(uuid) };
      }
    }
    for (const attr of PARAMETER_ANNOTATION_ATTRS) {
      const value = parameterAnnotationValue(next, attr);
      if (value && taken.has(value.uuid)) {
        next[attr] = { ...(next[attr] as Attrs), uuid: uuidv4() };
      }
    }
    if ('items' in next) next.items = renew(next.items);
    if ('notes' in next) next.notes = renew(next.notes);
    return next;
  };

  const visit = (item: JSONContent): JSONContent => ({
    ...item,
    ...(item.attrs ? { attrs: visitAttrs(item.attrs, true) } : {}),
    ...(item.marks
      ? {
          marks: item.marks.map((mark) =>
            mark.attrs
              ? { ...mark, attrs: visitAttrs(mark.attrs, false) }
              : mark,
          ),
        }
      : {}),
    ...(item.content ? { content: item.content.map(visit) } : {}),
  });

  return visit(tail);
};
