import { getSchema, type JSONContent } from '@tiptap/core';
import {
  DOMParser,
  DOMSerializer,
  Fragment,
  type DOMOutputSpec,
  type Mark,
  type Schema,
} from '@tiptap/pm/model';
import type {
  PassageSnapshot,
  PassageSource,
} from '@eightyfourthousand/lib-doc-model';
import { safeHref } from '@eightyfourthousand/lib-utils';

import { renderableForeignLang } from '../editor/extensions/Foreign/Foreign';
import { storageSerializer } from './bibliography-codec';
import {
  buildGlossarySchemaExtensions,
  WRAPPER_TAGS,
  type StoredElement,
} from './glossary-extensions';

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

/** Marks a paragraph the codec added around text no block held. */
const IMPLICIT = 'data-definition-implicit';

const BLOCK_TAGS = new Set([
  'P',
  ...WRAPPER_TAGS.map((tag) => tag.toUpperCase()),
]);

const isBlock = (node: ChildNode): node is Element =>
  node.nodeType === node.ELEMENT_NODE &&
  BLOCK_TAGS.has((node as Element).tagName);

/**
 * Shape an element's children as the schema's blocks. Whitespace between
 * blocks is dropped, as it would otherwise become a paragraph of its own;
 * within a block it is text, and kept. Text held by no block goes in a
 * paragraph marked to be written back without one.
 */
const shapeBlocks = (parent: Element) => {
  const children = [...parent.childNodes];
  if (children.some(isBlock)) {
    children.forEach((node) => {
      if (node.nodeType === node.TEXT_NODE && !node.textContent?.trim()) {
        node.remove();
      } else if (isBlock(node) && node.tagName !== 'P') {
        shapeBlocks(node);
      }
    });
    return;
  }
  if (!children.length) return;
  const paragraph = document.createElement('p');
  paragraph.setAttribute(IMPLICIT, '');
  paragraph.append(...children);
  parent.append(paragraph);
};

/**
 * Take the codec's paragraphs out again where they were added: a marked
 * paragraph alone in its block is written as its content.
 */
const unshapeBlocks = (container: HTMLElement) => {
  container.querySelectorAll(`p[${IMPLICIT}]`).forEach((paragraph) => {
    const parent = paragraph.parentElement;
    if (parent && parent.children.length === 1) {
      paragraph.replaceWith(...paragraph.childNodes);
    } else {
      paragraph.removeAttribute(IMPLICIT);
    }
  });
};

/**
 * An entry's stored definition as the blocks its document holds.
 *
 * Paragraphs and the blocks around them, with the bibliography's marks and the
 * TEI markup a definition carries, each keeping the element it was read from,
 * so an unedited definition is written back as it was stored. Comments are
 * not kept.
 */
export const glossaryDefinitionToContent = (
  definition: string | null,
  schema: Schema = glossarySchema(),
): JSONContent[] => {
  const container = document.createElement('div');
  container.innerHTML = closeEmptyElements(definition ?? '');
  shapeBlocks(container);
  const doc = DOMParser.fromSchema(schema).parse(container, {
    preserveWhitespace: 'full',
  });
  return ((doc.toJSON().content ?? []) as JSONContent[]).map((block) =>
    withoutPlainElements(block, schema),
  );
};

const sameAttributes = (a: Record<string, string>, b: Record<string, string>) =>
  Object.keys(a).length === Object.keys(b).length &&
  Object.entries(a).every(([name, value]) => b[name] === value);

/** Whether the storage serializer writes the stored element as it is. */
const writesAsStored = (spec: DOMOutputSpec, stored: StoredElement) => {
  const { dom } = DOMSerializer.renderSpec(document, spec);
  return (
    dom instanceof Element &&
    dom.tagName.toLowerCase() === stored.tag &&
    sameAttributes(
      Object.fromEntries(
        [...dom.attributes].map(({ name, value }) => [name, value]),
      ),
      stored.attributes,
    )
  );
};

/**
 * Forgets the stored element where it is the one the editor would write, so
 * a definition read back is the document it was written from.
 */
const withoutPlainElements = (
  node: JSONContent,
  schema: Schema,
): JSONContent => {
  const base = storageSerializer(schema);
  const plain = (
    attrs: Record<string, unknown> | undefined,
    spec: (attrs: Record<string, unknown>) => DOMOutputSpec | undefined,
  ) => {
    const stored = attrs?.stored as StoredElement | null | undefined;
    if (!stored) return attrs;
    const bare = { ...attrs, stored: null };
    const written = spec(bare);
    return written && writesAsStored(written, stored) ? bare : attrs;
  };
  const toDOM = base.nodes[node.type ?? ''];
  return {
    ...node,
    ...(node.attrs && toDOM
      ? {
          attrs: plain(node.attrs, (attrs) =>
            toDOM(schema.nodes[node.type as string].create(attrs)),
          ),
        }
      : {}),
    ...(node.marks
      ? {
          marks: node.marks.map((mark) => {
            const markToDOM = base.marks[mark.type];
            return markToDOM
              ? {
                  ...mark,
                  attrs: plain(mark.attrs, (attrs) =>
                    markToDOM(schema.mark(mark.type, attrs), true),
                  ),
                }
              : mark;
          }),
        }
      : {}),
    ...(node.content
      ? {
          content: node.content.map((child) =>
            withoutPlainElements(child, schema),
          ),
        }
      : {}),
  };
};

const serializers = new WeakMap<Schema, DOMSerializer>();

/** A stored element's attributes, with the ones the editor edits as they are now. */
const currentAttributes = (
  mark: Mark,
  { attributes }: StoredElement,
): Record<string, string> => {
  const current = { ...attributes };
  const set = (name: string, value: string | undefined) => {
    if (value) current[name] = value;
    else delete current[name];
  };
  if (mark.type.name === 'link' || mark.type.name === 'internalLink') {
    set('href', safeHref(mark.attrs.href as string | null | undefined));
  }
  if (mark.type.name === 'foreign') {
    set('lang', renderableForeignLang(mark.attrs.lang));
  }
  return current;
};

/**
 * The storage serializer, writing each paragraph, block and mark as the
 * element it was read from. What the editor added is written as a
 * bibliography row's.
 */
const glossaryStorageSerializer = (schema: Schema): DOMSerializer => {
  const cached = serializers.get(schema);
  if (cached) return cached;
  const base = storageSerializer(schema);
  const marks = Object.fromEntries(
    Object.entries(base.marks).map(([name, toDOM]) => [
      name,
      (mark: Mark, inline: boolean): DOMOutputSpec => {
        const stored = mark.attrs.stored as StoredElement | null | undefined;
        return stored
          ? [stored.tag, currentAttributes(mark, stored), 0]
          : toDOM(mark, inline);
      },
    ]),
  );
  const serializer = new DOMSerializer(
    {
      ...base.nodes,
      paragraph: (node) => [
        'p',
        (node.attrs.stored as StoredElement | null)?.attributes ?? {},
        0,
      ],
      definitionWrapper: (node) => [node.attrs.tag, node.attrs.attributes, 0],
    },
    marks,
  );
  serializers.set(schema, serializer);
  return serializer;
};

/**
 * A definition's blocks as the HTML stored for it, or an empty string when it
 * holds no text.
 */
export const glossaryContentToDefinition = (
  content: JSONContent[] | Fragment,
  schema: Schema = glossarySchema(),
): string => {
  const fragment =
    content instanceof Fragment
      ? content
      : Fragment.fromArray(content.map((block) => schema.nodeFromJSON(block)));
  if (!fragment.textBetween(0, fragment.size, '', '￼').trim()) return '';
  const container = document.createElement('div');
  container.appendChild(
    glossaryStorageSerializer(schema).serializeFragment(fragment),
  );
  unshapeBlocks(container);
  // Stored definitions hold the character, never the entity.
  return container.innerHTML.replace(/&nbsp;/g, '\u00a0');
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
