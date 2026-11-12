import { getSchema, type JSONContent } from '@tiptap/core';
import { DOMParser, Fragment, type Schema } from '@tiptap/pm/model';
import type {
  PassageSnapshot,
  PassageSource,
} from '@eightyfourthousand/lib-doc-model';

import {
  dropWhitespaceBetweenBlocks,
  storageSerializer,
} from './bibliography-codec';
import { buildGlossarySchemaExtensions } from './glossary-extensions';

/** Where a glossary snapshot came from, for the loader's report. */
export const GLOSSARY_SOURCE_NAME = 'glossary';

/** An entry's stored definition, as the codec reads it. */
export type GlossaryDefinitionRow = {
  uuid: string;
  definition: string | null;
};

let defaultSchema: Schema | undefined;

/** The glossary definition schema, built once. */
export const glossarySchema = (): Schema =>
  (defaultSchema ??= getSchema(buildGlossarySchemaExtensions()));

/** Elements HTML already reads as empty. */
const VOID_ELEMENTS = new Set(['br', 'hr', 'img', 'wbr']);

/**
 * `<ptr …/>` read as an empty element, as the stored XML means and as the
 * save reads it. HTML would open the element and wrap what follows it.
 */
const closeEmptyElements = (html: string) =>
  html.replace(
    /<([a-zA-Z][\w:-]*)((?:\s[^<>]*?)?)\s*\/>/g,
    (_, tag: string, attributes: string) =>
      VOID_ELEMENTS.has(tag.toLowerCase())
        ? `<${tag}${attributes}>`
        : `<${tag}${attributes}></${tag}>`,
  );

/** Block wrappers TEI left around a definition's paragraphs. */
const WRAPPERS = new Set(['NOTE', 'DIV']);

/** Lift the paragraphs out of the wrappers around them. */
const unwrapBlocks = (container: HTMLElement) => {
  for (;;) {
    const wrapper = [...container.children].find((el) =>
      WRAPPERS.has(el.tagName),
    );
    if (!wrapper) return;
    wrapper.replaceWith(...wrapper.childNodes);
  }
};

/**
 * An entry's stored definition as the blocks its document holds.
 *
 * Paragraphs, with the bibliography's marks and the TEI inline markup a
 * definition carries, empty elements included. Wrappers around the paragraphs (`<note>`, `<div>`) and
 * comments are not kept; whitespace within a paragraph is.
 */
export const glossaryDefinitionToContent = (
  definition: string | null,
  schema: Schema = glossarySchema(),
): JSONContent[] => {
  const container = document.createElement('div');
  container.innerHTML = closeEmptyElements(definition ?? '');
  unwrapBlocks(container);
  dropWhitespaceBetweenBlocks(container);
  const doc = DOMParser.fromSchema(schema).parse(container, {
    preserveWhitespace: 'full',
  });
  return (doc.toJSON().content ?? []) as JSONContent[];
};

/**
 * A definition's blocks as the HTML stored for it, or null when it holds no
 * text.
 */
export const glossaryContentToDefinition = (
  content: JSONContent[] | Fragment,
  schema: Schema = glossarySchema(),
): string | null => {
  const fragment =
    content instanceof Fragment
      ? content
      : Fragment.fromArray(content.map((block) => schema.nodeFromJSON(block)));
  if (!fragment.textBetween(0, fragment.size, '', '￼').trim()) return null;
  const container = document.createElement('div');
  container.appendChild(storageSerializer(schema).serializeFragment(fragment));
  return container.innerHTML;
};

/**
 * A passage source for glossary rows, seeding each row's document from its
 * entry's definition. `read` returns the rows it has; missing ones are
 * omitted.
 */
export const glossaryRowSource = ({
  workUuid,
  read,
  schema = glossarySchema(),
}: {
  workUuid: string;
  read: (uuids: string[]) => Promise<GlossaryDefinitionRow[]>;
  schema?: Schema;
}): PassageSource => ({
  name: GLOSSARY_SOURCE_NAME,
  async loadPassages(requested, uuids): Promise<PassageSnapshot[]> {
    if (requested !== workUuid) {
      console.error(
        `glossary source is wired to work ${workUuid} but was asked for ${requested}`,
      );
      return [];
    }
    if (!uuids.length) return [];
    const rows = await read(uuids);
    return rows.map(({ uuid, definition }) => ({
      uuid,
      content: glossaryDefinitionToContent(definition, schema),
    }));
  },
});
