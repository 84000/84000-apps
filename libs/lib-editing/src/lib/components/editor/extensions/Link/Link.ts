import { Link as TipTapLink } from '@tiptap/extension-link';
import { v4 as uuidv4 } from 'uuid';
import { createMarkViewDom, registerEditorElement } from '../../util';

export const Link = TipTapLink.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      uuid: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('uuid'),
      },
    };
  },
  addCommands() {
    const name = this.name;
    return {
      ...this.parent?.(),
      setLink(attributes) {
        return ({ commands }) => {
          return commands.setMark(name, {
            ...attributes,
            uuid: uuidv4(),
          });
        };
      },
      toggleLink() {
        return ({ commands }) => {
          return commands.toggleMark(name, { uuid: uuidv4() });
        };
      },
    };
  },
  addMarkView() {
    return (props) => {
      const isEditable = props.editor.isEditable;
      const { dom } = createMarkViewDom({
        ...props,
        element: 'a',
      });

      dom.setAttribute('href', props.mark.attrs.href);
      dom.setAttribute('target', '_blank');
      dom.setAttribute('rel', 'noreferrer');

      // Set uuid attribute for HoverCardProvider identification
      if (props.mark.attrs.uuid) {
        dom.setAttribute('uuid', props.mark.attrs.uuid);
      }

      // Only add type attribute in edit mode for hover card detection
      if (isEditable) {
        dom.setAttribute('type', 'link');
        registerEditorElement(dom, props.editor);
      }

      return {
        dom,
        contentDOM: dom,
      };
    };
  },
}).configure({
  openOnClick: false,
});
