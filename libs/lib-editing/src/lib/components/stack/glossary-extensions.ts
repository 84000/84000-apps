import { Mark, Node, type Extensions } from '@tiptap/core';

import { buildBibliographySchemaExtensions } from './bibliography-extensions';

/**
 * Inline elements a stored definition carries from TEI, kept as they are.
 * `span` covers the legacy cross-links (`data-glossary-id`) and language
 * spans; the editor's own spans are matched by their marks first.
 */
const KEPT_ELEMENTS = new Set([
  'span',
  'cite',
  'distinct',
  'emph',
  'foreign',
  'hi',
  'ptr',
  'ref',
  'tei:foreign',
  'term',
  'title',
]);

/** Below every other mark's rules, so the editor's own marks win. */
const KEPT_MARKUP_PRIORITY = 10;

/** Above every mark's rules: an empty element holds no text to mark. */
const EMPTY_MARKUP_PRIORITY = 100;

/** Elements kept as empty pointers: the kept markup, and bare links. */
const POINTER_ELEMENTS = new Set([...KEPT_ELEMENTS, 'a']);

const attributesOf = (element: HTMLElement): Record<string, string> =>
  Object.fromEntries(
    [...element.attributes].map(({ name, value }) => [name, value]),
  );

/**
 * Inline markup a definition holds beyond the editor's marks, kept with its
 * element and attributes so an edit elsewhere in the entry does not drop it.
 * Elements of one kind may nest, so it does not exclude itself.
 */
export const DefinitionMarkup = Mark.create({
  name: 'definitionMarkup',
  excludes: '',
  inclusive: false,

  addAttributes() {
    return {
      tag: {
        default: 'span',
        rendered: false,
        parseHTML: (element) => element.tagName.toLowerCase(),
      },
      attributes: {
        default: {},
        rendered: false,
        parseHTML: attributesOf,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: '*',
        priority: KEPT_MARKUP_PRIORITY,
        getAttrs: (element) =>
          KEPT_ELEMENTS.has(element.tagName.toLowerCase()) ? null : false,
      },
    ];
  },

  renderHTML({ mark }) {
    const { tag, attributes } = mark.attrs as {
      tag: string;
      attributes: Record<string, string>;
    };
    return [tag, attributes, 0];
  },
});

/**
 * An empty element a definition holds, such as `<ptr target="…"/>` or a
 * pending reference, which readers fill in. Kept whole, as an atom, since a
 * mark on no text would be dropped.
 */
export const DefinitionPointer = Node.create({
  name: 'definitionPointer',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      tag: {
        default: 'ptr',
        rendered: false,
        parseHTML: (element) => element.tagName.toLowerCase(),
      },
      attributes: {
        default: {},
        rendered: false,
        parseHTML: attributesOf,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: '*',
        priority: EMPTY_MARKUP_PRIORITY,
        getAttrs: (element) =>
          POINTER_ELEMENTS.has(element.tagName.toLowerCase()) &&
          !element.hasChildNodes()
            ? null
            : false,
      },
    ];
  },

  renderHTML({ node }) {
    const { tag, attributes } = node.attrs as {
      tag: string;
      attributes: Record<string, string>;
    };
    return [tag, attributes];
  },
});

/**
 * The schema for a glossary entry's definition: the bibliography's inline
 * set, plus the TEI markup stored definitions carry.
 */
export const buildGlossarySchemaExtensions = (): Extensions => [
  ...buildBibliographySchemaExtensions(),
  DefinitionMarkup,
  DefinitionPointer,
];
