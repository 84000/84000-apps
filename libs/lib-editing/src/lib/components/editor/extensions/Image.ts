import Image from '@tiptap/extension-image';
import { v4 as uuidv4 } from 'uuid';

export default Image.extend({
  addCommands() {
    return {
      setImage:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
            uuid: uuidv4(),
          });
        },
    };
  },
});
