import { Mark, mergeAttributes } from '@tiptap/core';
import { v4 as uuidv4 } from 'uuid';
import { createMarkViewDom, registerEditorElement } from '../../util';

export interface InternalLinkOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    internalLink: {
      setInternalLink: (entity: string, type: string) => ReturnType;
      unsetInternalLink: () => ReturnType;
    };
  }
}

export const InternalLink = Mark.create<InternalLinkOptions>({
  name: 'internalLink',
  addAttributes() {
    return {
      entity: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('entity'),
      },
      type: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('entity-type'),
      },
      href: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('href'),
      },
      uuid: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('uuid'),
      },
    };
  },
  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },
  parseHTML() {
    return [
      {
        tag: 'a[type="internalLink"]',
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'a',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },
  addMarkView() {
    return (props) => {
      const isEditable = props.editor.isEditable;
      const { dom } = createMarkViewDom({
        ...props,
        element: 'a',
        className: props.mark.attrs.toh,
      });

      dom.setAttribute('href', props.mark.attrs.href);
      dom.setAttribute('target', '_blank');
      dom.setAttribute('rel', 'noreferrer');

      // Set attributes for HoverCardProvider identification
      if (props.mark.attrs.uuid) {
        dom.setAttribute('uuid', props.mark.attrs.uuid);
      }
      if (props.mark.attrs.entity) {
        dom.setAttribute('entity', props.mark.attrs.entity);
      }
      if (props.mark.attrs.type) {
        dom.setAttribute('entity-type', props.mark.attrs.type);
      }

      // Only add type attribute in edit mode for hover card detection
      if (isEditable) {
        dom.setAttribute('type', 'internalLink');
        registerEditorElement(dom, props.editor);
      }

      return {
        dom,
        contentDOM: dom,
      };
    };
  },
  addCommands() {
    return {
      setInternalLink:
        (entity: string, type: string) =>
        ({ chain }) => {
          return chain()
            .setMark(this.name, {
              entity,
              type,
              uuid: uuidv4(),
              href: `/entity/${type}/${entity}`,
            })
            .run();
        },
      unsetInternalLink:
        () =>
        ({ chain }) => {
          return chain()
            .unsetMark(this.name)
            .resetAttributes(this.name, ['entity', 'type'])
            .run();
        },
    };
  },
});
