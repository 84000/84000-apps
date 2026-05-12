import { v4 as uuidv4 } from 'uuid';
import { cn } from '@eightyfourthousand/lib-utils';
import { createMarkViewDom, registerEditorElement } from '../../util';
import { GlossaryInstanceNodeSSR } from './GlossaryInstanceNode.ssr';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    glossaryInstance: {
      setGlossaryInstance: (args: {
        glossary: string;
        authority: string;
      }) => ReturnType;
      unsetGlossaryInstance: () => ReturnType;
    };
  }
}

export const GlossaryInstanceNode = GlossaryInstanceNodeSSR.extend({
  addMarkView() {
    return (props) => {
      const isEditable = props.editor.isEditable;
      const { dom } = createMarkViewDom({
        ...props,
        element: 'span',
        className: cn('glossary-instance', props.mark.attrs.toh),
      });

      // Set attributes for HoverCardProvider identification
      if (props.mark.attrs.uuid) {
        dom.setAttribute('uuid', props.mark.attrs.uuid);
      }
      if (props.mark.attrs.authority) {
        dom.setAttribute('authority', props.mark.attrs.authority);
      }
      if (props.mark.attrs.glossary) {
        dom.setAttribute('glossary', props.mark.attrs.glossary);
      }

      // Only add type attribute and register in edit mode for hover card detection
      if (isEditable) {
        dom.setAttribute('type', 'glossaryInstance');
        registerEditorElement(dom, props.editor);
      }

      dom.addEventListener('click', () => {
        const { glossary } = props.mark.attrs;
        if (!glossary) {
          return;
        }

        const query = new URLSearchParams(window.location.search);
        query.set('right', `open:glossary:${glossary}`);
        window.history.pushState({}, '', `?${query.toString()}`);
      });

      return {
        dom,
        contentDOM: dom,
      };
    };
  },

  addCommands() {
    return {
      setGlossaryInstance:
        ({ glossary, authority }) =>
        ({ chain }) => {
          return chain()
            .setMark(this.name)
            .updateAttributes(this.name, {
              glossary,
              authority,
              uuid: uuidv4(),
            })
            .run();
        },

      unsetGlossaryInstance:
        () =>
        ({ chain }) => {
          return chain()
            .unsetMark(this.name)
            .resetAttributes(this.name, 'glossary')
            .resetAttributes(this.name, 'authority')
            .run();
        },
    };
  },
});
