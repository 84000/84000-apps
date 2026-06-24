import { Node, mergeAttributes } from '@tiptap/core';
import {
  PASSAGE_CONTENT_CLASS,
  PASSAGE_INNER_CLASS,
  PASSAGE_LABEL_CLASS,
  PASSAGE_REFERENCES_CLASS,
  PASSAGE_WRAPPER_CLASS,
} from './classes';

type PassageReference = {
  uuid: string;
  label: string | null;
  sort: number;
  type: string;
};

// The compare-mode Tibetan source and the reader bookmark icon are toh- and
// bookmark-dependent chrome that lives OUTSIDE ProseMirror's editable content.
// They are rendered here as hidden placeholders and populated imperatively by
// the PassageNode view plugin (see PassageNode.ts) from navigation state.
const bookmarkIcon = (): Array<unknown> => [
  'svg',
  {
    xmlns: 'http://www.w3.org/2000/svg',
    width: '12',
    height: '12',
    viewBox: '0 0 24 24',
    fill: 'currentColor',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    class: 'text-accent size-3',
  },
  ['path', { d: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z' }],
];

export const PassageNodeSSR = Node.create({
  name: 'passage',
  group: 'block',
  content: 'block+',

  parseHTML() {
    return [{ tag: 'passage' }];
  },

  addAttributes() {
    return {
      label: {
        default: null,
        parseHTML: (element) => element.getAttribute('label'),
        renderHTML: (attributes) =>
          attributes.label ? { label: attributes.label } : {},
      },
      sort: {
        default: 0,
        parseHTML: (element) => element.getAttribute('sort'),
        renderHTML: (attributes) => ({ sort: attributes.sort }),
      },
      // Internal editor state — never serialize to the public SSR markup.
      alignments: {
        default: {},
        renderHTML: () => ({}),
      },
      references: {
        default: [],
        renderHTML: () => ({}),
      },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    const uuid = (node.attrs.uuid ?? HTMLAttributes.uuid) as string | undefined;
    const toh = (node.attrs.toh ?? HTMLAttributes.toh) as string | undefined;
    const type = (node.attrs.type ?? HTMLAttributes.type) as string | undefined;
    const label = (node.attrs.label ?? '') as string;
    const references = (node.attrs.references ?? []) as PassageReference[];

    const wrapperAttrs = mergeAttributes(HTMLAttributes, {
      class: PASSAGE_WRAPPER_CLASS,
      ...(toh ? { 'data-toh': toh } : {}),
      ...(type ? { 'data-passage-type': type } : {}),
      ...(node.attrs.invalid ? { 'data-invalid': 'true' } : {}),
      ...(uuid ? { id: uuid } : {}),
    });

    // The label doubles as the dropdown trigger; the PassageNode click plugin
    // opens the stable menu overlay when it is pressed.
    const labelEl: Array<unknown> = [
      'div',
      {
        class: PASSAGE_LABEL_CLASS,
        contenteditable: 'false',
        'data-passage-label': '',
        ...(uuid ? { 'data-uuid': uuid } : {}),
      },
      label,
    ];

    const bookmarkEl: Array<unknown> = [
      'div',
      {
        class:
          'passage-bookmark hidden absolute -left-15.75 top-6 w-16 flex justify-end',
        contenteditable: 'false',
      },
      bookmarkIcon(),
    ];

    const content: Array<unknown> = ['div', { class: PASSAGE_CONTENT_CLASS }, 0];

    const referencesNode =
      references.length > 0
        ? [
            'div',
            { class: PASSAGE_REFERENCES_CLASS, contenteditable: 'false' },
            ...references.flatMap((ref, index) => {
              const linkText = ref.label || ref.uuid.slice(0, 6);
              const link = [
                'a',
                {
                  href: `#${ref.uuid}`,
                  'data-passage-reference': '',
                  'data-ref-uuid': ref.uuid,
                  'data-ref-type': ref.type,
                },
                linkText,
              ] as unknown;
              return index === 0 ? [link] : [', ', link];
            }),
          ]
        : null;

    const innerColumnChildren: Array<unknown> = [labelEl, bookmarkEl, content];
    if (referencesNode) innerColumnChildren.push(referencesNode);

    // Second flex column: hidden compare-source placeholder, populated by the
    // view plugin when compare mode is active and the passage has an alignment.
    const compareSource: Array<unknown> = [
      'div',
      {
        class: 'passage-compare-source w-full hidden md:mt-1',
        contenteditable: 'false',
        'data-compare-source': '',
      },
      [
        'div',
        { class: 'passage pl-6 @c/sidebar:pl-4' },
        [
          'div',
          {
            class:
              'passage-compare-text leading-7 font-tibetan text-lg whitespace-normal mt-1.5 pb-4 md:pb-2',
          },
          '',
        ],
      ],
    ];

    return [
      'div',
      wrapperAttrs,
      [
        'div',
        { class: 'w-full' },
        ['div', { class: PASSAGE_INNER_CLASS }, ...innerColumnChildren],
      ],
      compareSource,
    ];
  },
});

export default PassageNodeSSR;
