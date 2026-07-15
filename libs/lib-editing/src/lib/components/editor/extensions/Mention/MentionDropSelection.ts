import { Plugin, TextSelection } from '@tiptap/pm/state';

export const mentionDropSelectionPlugin = (mentionName: string) =>
  new Plugin({
    appendTransaction(transactions, _oldState, newState) {
      const isDrop = transactions.some(
        (transaction) => transaction.getMeta('uiEvent') === 'drop',
      );
      const { selection } = newState;

      if (!isDrop || selection.empty) {
        return null;
      }

      const droppedNode = newState.doc.nodeAt(selection.from);
      const selectsOnlyMention =
        droppedNode?.type.name === mentionName &&
        selection.to === selection.from + droppedNode.nodeSize;

      if (!selectsOnlyMention) {
        return null;
      }

      return newState.tr.setSelection(
        TextSelection.near(newState.doc.resolve(selection.to), 1),
      );
    },
  });
