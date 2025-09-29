import { Extension } from '@tiptap/core';

export const resetUuidPlugin = new Extension({
  key: new PluginKey('resetUuid'),
  appendTransaction(transactions, oldState, newState) {
    const tr = newState.tr;
    let modified = false;

    // Check if any transaction added new content
    transactions.forEach((transaction) => {
      transaction.steps.forEach((step) => {
        if (step.slice && step.slice.content) {
          // Walk through new content and reset UUIDs
          step.slice.content.descendants((node, pos, parent) => {
            if (node.attrs && node.attrs.uuid) {
              // Reset UUID to null so renderHTML generates a new one
              tr.setNodeMarkup(step.from + pos, null, {
                ...node.attrs,
                uuid: null,
              });
              modified = true;
            }
          });
        }
      });
    });

    return modified ? tr : null;
  },
});
