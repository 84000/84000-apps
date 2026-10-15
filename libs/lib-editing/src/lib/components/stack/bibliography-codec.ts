import { getSchema, type JSONContent } from '@tiptap/core';
import {
  DOMParser,
  DOMSerializer,
  Fragment,
  type Node as PMNode,
  type Schema,
} from '@tiptap/pm/model';
import type {
  PassageSnapshot,
  PassageSource,
  StackRowKind,
} from '@eightyfourthousand/lib-doc-model';

import { buildBibliographySchemaExtensions } from './bibliography-extensions';

/** Where a bibliography snapshot came from, for the loader's report. */
export const BIBLIOGRAPHY_SOURCE_NAME = 'bibliography';

/** A stored bibliography row, as the codec reads it. A heading's `html` is plain text. */
export type BibliographyRowHTML = {
  uuid: string;
  html: string;
  isHeading?: boolean;
};

let defaultSchema: Schema | undefined;

/** The bibliography schema, built once. */
export const bibliographySchema = (): Schema =>
  (defaultSchema ??= getSchema(buildBibliographySchemaExtensions()));

const serializers = new WeakMap<Schema, DOMSerializer>();

/**
 * The schema's serializer, less the editor's presentation: a paragraph is a
 * bare `<p>` and a link a bare `<a href>`, which is what stored entries hold
 * and what the reader styles. Everything else renders as the editor does.
 */
const storageSerializer = (schema: Schema): DOMSerializer => {
  const cached = serializers.get(schema);
  if (cached) return cached;
  const base = DOMSerializer.fromSchema(schema);
  const serializer = new DOMSerializer(
    { ...base.nodes, paragraph: () => ['p', 0] },
    {
      ...base.marks,
      link: (mark) => [
        'a',
        mark.attrs.href ? { href: mark.attrs.href as string } : {},
        0,
      ],
    },
  );
  serializers.set(schema, serializer);
  return serializer;
};

/**
 * Drops whitespace between top-level blocks. Parsing keeps whitespace in full,
 * and a newline between two `<p>`s would otherwise become a paragraph of its
 * own. Within a block it is text, and kept.
 */
const dropWhitespaceBetweenBlocks = (container: HTMLElement) => {
  const hasBlocks = [...container.children].some((el) => el.tagName === 'P');
  if (!hasBlocks) return;
  [...container.childNodes].forEach((node) => {
    if (node.nodeType === node.TEXT_NODE && !node.textContent?.trim()) {
      node.remove();
    }
  });
};

/**
 * A row's stored value as the blocks its document holds.
 *
 * An entry's value is HTML. Whitespace is preserved in full, as the stack's
 * paste and re-read paths do, so newlines, runs of spaces and soft hyphens
 * survive a round trip. A heading's value is plain text (the save reduces it
 * to text), so it is read as text, never markup, into one paragraph.
 */
export const bibliographyHTMLToContent = (
  html: string,
  kind: StackRowKind = 'entry',
  schema: Schema = bibliographySchema(),
): JSONContent[] => {
  if (kind === 'heading') {
    return [
      {
        type: 'paragraph',
        content: html ? [{ type: 'text', text: html }] : [],
      },
    ].map((block) => schema.nodeFromJSON(block).toJSON() as JSONContent);
  }
  const container = document.createElement('div');
  container.innerHTML = html;
  dropWhitespaceBetweenBlocks(container);
  const doc = DOMParser.fromSchema(schema).parse(container, {
    preserveWhitespace: 'full',
  });
  return (doc.toJSON().content ?? []) as JSONContent[];
};

/**
 * A row's blocks as the HTML stored for it.
 *
 * An entry is stored as paragraphs. A heading is stored as plain text, its
 * marks dropped and its paragraphs joined by a space, unescaped, as the save
 * stores it. An empty row is an empty string.
 */
export const bibliographyContentToHTML = (
  content: JSONContent[] | Fragment,
  kind: StackRowKind,
  schema: Schema = bibliographySchema(),
): string => {
  const fragment =
    content instanceof Fragment
      ? content
      : Fragment.fromArray(content.map((block) => schema.nodeFromJSON(block)));
  if (!fragment.textBetween(0, fragment.size, '', '￼')) return '';

  if (kind === 'heading') {
    const lines: string[] = [];
    fragment.forEach((block) =>
      lines.push(block.textBetween(0, block.content.size, '', leafText)),
    );
    return lines.join(' ');
  }

  const container = document.createElement('div');
  container.appendChild(storageSerializer(schema).serializeFragment(fragment));
  return container.innerHTML;
};

/** A leaf's text in a heading: a mention reads as its items' text. */
const leafText = (leaf: PMNode): string =>
  leaf.type.name === 'mention'
    ? ((leaf.attrs.items ?? []) as { text?: string }[])
        .map((item) => item.text ?? '')
        .join(', ')
    : '';

/**
 * A passage source for bibliography rows, seeding each row's document from
 * its stored HTML. `read` returns the rows it has; missing ones are omitted.
 */
export const bibliographyRowSource = ({
  workUuid,
  read,
  schema = bibliographySchema(),
}: {
  workUuid: string;
  read: (uuids: string[]) => Promise<BibliographyRowHTML[]>;
  schema?: Schema;
}): PassageSource => ({
  name: BIBLIOGRAPHY_SOURCE_NAME,
  async loadPassages(requested, uuids): Promise<PassageSnapshot[]> {
    if (requested !== workUuid) {
      console.error(
        `bibliography source is wired to work ${workUuid} but was asked for ${requested}`,
      );
      return [];
    }
    if (!uuids.length) return [];
    const rows = await read(uuids);
    return rows.map(({ uuid, html, isHeading }) => ({
      uuid,
      content: bibliographyHTMLToContent(
        html,
        isHeading ? 'heading' : 'entry',
        schema,
      ),
    }));
  },
});
