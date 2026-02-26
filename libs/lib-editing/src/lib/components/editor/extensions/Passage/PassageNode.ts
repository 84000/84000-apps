import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer, mergeAttributes } from '@tiptap/react';
import { Passage } from './Passage';
import { Selection, TextSelection } from '@tiptap/pm/state';
import { ResolvedPos } from '@tiptap/pm/model';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    passage: {
      refreshLabelsAfter: () => ReturnType;
      splitPassage: () => ReturnType;
    };
  }
}

const currentPassageDepth = ($from: ResolvedPos) => {
  let passageDepth = null;
  for (let i = $from.depth; i >= 0; i--) {
    if ($from.node(i).type.name === 'passage') {
      passageDepth = i;
      break;
    }
  }

  return passageDepth;
};

const incrementLabel = (label: string, depth = -1) => {
  const labelParts: (string | number)[] = ((label as string) || '').split('.');
  const index = depth === -1 ? labelParts.length - 1 : depth;
  const toIncrement = `${labelParts[index]}` || '0';
  const newVal = Number.parseInt(toIncrement) + 1;
  labelParts[index] = newVal;

  return labelParts.join('.');
};

export const PassageNode = Node.create({
  name: 'passage',
  group: 'block',
  content: 'block+',
  parseHTML() {
    return [
      {
        tag: 'passage',
      },
    ];
  },
  addAttributes() {
    return {
      label: {
        default: null,
        parseHTML: (element) => element.getAttribute('label'),
        renderHTML: (attributes) => {
          return mergeAttributes(attributes, {
            label: attributes.label,
          });
        },
      },
      sort: {
        default: 0,
        parseHTML: (element) => element.getAttribute('sort'),
        renderHTML: (attributes) => {
          return mergeAttributes(attributes, {
            sort: attributes.sort,
          });
        },
      },
      alignments: {
        default: {},
      },
      references: {
        default: [],
      },
    };
  },
  renderHTML({ HTMLAttributes }) {
    return ['passage', mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(Passage);
  },
  addCommands() {
    return {
      refreshLabelsAfter:
        () =>
        ({ state, dispatch }) => {
          if (!dispatch) {
            return true;
          }

          const { selection } = state;
          const { $from } = selection;
          const txn = state.tr;

          const passageDepth = currentPassageDepth($from);
          if (passageDepth === null) {
            return false;
          }

          const passagePos = $from.start(passageDepth) - 1;
          const currentPassage = $from.node(passageDepth);
          const currentLabel = currentPassage.attrs.label as string;

          if (!currentLabel) {
            return false;
          }

          const currentPrefix = currentLabel.split('.').slice(0, -1).join('.');
          const currentDepth = currentPrefix.length;

          // Optimized: Only traverse siblings after current position instead of entire document
          const parentDepth = passageDepth - 1;
          if (parentDepth < 0) {
            return false;
          }

          const parentNode = $from.node(parentDepth);
          const startIndex = $from.index(parentDepth);

          // Start position after current passage
          let pos = passagePos + currentPassage.nodeSize;

          for (let i = startIndex + 1; i < parentNode.childCount; i++) {
            const child = parentNode.child(i);

            if (child.type.name !== 'passage') {
              pos += child.nodeSize;
              continue;
            }

            const targetLabel = child.attrs.label as string;
            if (!targetLabel) {
              pos += child.nodeSize;
              continue;
            }

            // Early exit - if we've moved past our prefix scope, stop
            if (!targetLabel.startsWith(currentPrefix)) {
              break;
            }

            txn.setNodeMarkup(pos, null, {
              ...child.attrs,
              label: incrementLabel(child.attrs.label, currentDepth),
            });

            pos += child.nodeSize;
          }

          dispatch(txn);
          return true;
        },
      splitPassage:
        () =>
        ({ state, dispatch }) => {
          const { selection } = state;
          const { $from } = selection;

          // Find the passage node that contains the current selection
          const passageDepth = currentPassageDepth($from);
          if (passageDepth === null) {
            return false;
          }

          const passageNode = $from.node(passageDepth);
          const passageStart = $from.start(passageDepth) - 1; // -1 to include the passage node itself
          const passageEnd = $from.end(passageDepth) + 1; // +1 to include the passage node itself

          // Get the position within the passage content
          const posInPassage = $from.pos - $from.start(passageDepth);

          // Split the passage content
          const beforeContent = passageNode.content.cut(0, posInPassage);
          const afterContent = passageNode.content.cut(posInPassage);

          if (!dispatch) return true;

          const tr = state.tr;

          // Replace current passage with first part
          tr.replaceWith(
            passageStart,
            passageEnd,
            state.schema.nodes.passage.create(passageNode.attrs, beforeContent),
          );

          // Calculate where to insert the new passage
          const newPassagePos = passageStart + beforeContent.size + 2; // +2 for passage wrapper
          const oldAttrs = passageNode.attrs;
          const attrs = {
            ...oldAttrs,
            uuid: null,
            label: incrementLabel(oldAttrs.label),
          };
          // Insert new passage with remaining content
          tr.insert(
            newPassagePos,
            state.schema.nodes.passage.create(attrs, afterContent),
          );

          // move the cursor to the new paragraph
          const $pos = tr.doc.resolve(newPassagePos + 1);
          const newSelection =
            TextSelection.findFrom($pos, 1, true) || Selection.near($pos, 1);
          if (newSelection) {
            tr.setSelection(newSelection);
          }

          dispatch(tr);
          return true;
        },
    };
  },
});
