import { Link as TipTapLink } from '@tiptap/extension-link';
import { ReactMarkViewRenderer } from '@tiptap/react';
import { v4 as uuidv4 } from 'uuid';
import { LinkView } from './LinkView';

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
    return ReactMarkViewRenderer(LinkView);
  },
}).configure({
  openOnClick: true,
});
