import { LINK_STYLE } from '@design-system';
import Link from '@tiptap/extension-link';
import { v4 as uuidv4 } from 'uuid';

export default Link.extend({
  addCommands() {
    const name = this.name;
    return {
      ...this.parent?.(),
      setLink() {
        return ({ commands }) => {
          return commands.setMark(name, { uuid: uuidv4() });
        };
      },
      toggleLink() {
        return ({ commands }) => {
          return commands.toggleMark(name, { uuid: uuidv4() });
        };
      },
    };
  },
}).configure({
  HTMLAttributes: {
    class: LINK_STYLE,
  },
  openOnClick: true,
});
