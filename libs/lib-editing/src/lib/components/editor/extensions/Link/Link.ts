import { Link as TipTapLink } from '@tiptap/extension-link';
import { ReactMarkViewRenderer } from '@tiptap/react';
import { v4 as uuidv4 } from 'uuid';
import { LinkView } from './LinkView';
import { createMarkViewDom } from '../../util';

export const Link = TipTapLink.extend({
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
    if (!this.editor.isEditable) {
      return (props) => {
        const { dom } = createMarkViewDom({
          ...props,
          element: 'a',
        });

        dom.setAttribute('href', props.mark.attrs.href);
        dom.setAttribute('target', '_blank');
        dom.setAttribute('rel', 'noreferrer');

        return {
          dom,
          contentDOM: dom,
        };
      };
    }
    return ReactMarkViewRenderer(LinkView);
  },
}).configure({
  openOnClick: true,
});
