import { LineNodeSSR } from './LineNode.ssr';

export const LineNode = LineNodeSSR.extend({
  addKeyboardShortcuts() {
    return {
      Enter: () => this.editor.commands.splitListItem(this.name),
    };
  },
});
