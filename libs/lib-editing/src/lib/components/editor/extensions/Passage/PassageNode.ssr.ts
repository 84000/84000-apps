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
          mergeAttributes(attributes, { label: attributes.label }),
      },
      sort: {
        default: 0,
        parseHTML: (element) => element.getAttribute('sort'),
        renderHTML: (attributes) =>
          mergeAttributes(attributes, { sort: attributes.sort }),
      },
      alignments: {
        default: {},
      },
      references: {
        default: [],
      },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    const uuid = (node.attrs.uuid ?? HTMLAttributes.uuid) as string | undefined;
    const toh = (node.attrs.toh ?? HTMLAttributes.toh) as string | undefined;
    const label = (node.attrs.label ?? '') as string;
    const references = (node.attrs.references ?? []) as PassageReference[];

    const wrapperAttrs = mergeAttributes(HTMLAttributes, {
      class: [PASSAGE_WRAPPER_CLASS, toh].filter(Boolean).join(' '),
      ...(uuid ? { id: uuid } : {}),
    });

    const inner: Array<unknown> = [
      'div',
      { class: PASSAGE_LABEL_CLASS, contenteditable: 'false' },
      label,
    ];

    const content: Array<unknown> = [
      'div',
      { class: PASSAGE_CONTENT_CLASS },
      0,
    ];

    const referencesNode =
      references.length > 0
        ? [
            'div',
            { class: PASSAGE_REFERENCES_CLASS, contenteditable: 'false' },
            ...references.flatMap((ref, index) => {
              const linkText = ref.label || ref.uuid.slice(0, 6);
              const link = [
                'a',
                { href: `#${ref.uuid}` },
                linkText,
              ] as unknown;
              return index === 0 ? [link] : [', ', link];
            }),
          ]
        : null;

    const innerColumnChildren: Array<unknown> = [inner, content];
    if (referencesNode) innerColumnChildren.push(referencesNode);

    return [
      'div',
      wrapperAttrs,
      [
        'div',
        { class: 'w-full' },
        ['div', { class: PASSAGE_INNER_CLASS }, ...innerColumnChildren],
      ],
    ];
  },
});

export default PassageNodeSSR;
