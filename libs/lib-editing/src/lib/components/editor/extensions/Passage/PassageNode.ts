import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer, mergeAttributes } from '@tiptap/react';
import { Passage } from './Passage';
import { Selection, TextSelection } from '@tiptap/pm/state';
import { Fragment, ResolvedPos } from '@tiptap/pm/model';
import { incrementLabel } from './label';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    passage: {
      normalizeLabelsAfter: () => ReturnType;
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
      normalizeLabelsAfter:
        () =>
          ({ dispatch, tr }) => {
            if (!dispatch) return true;

            // Use tr.selection so this works correctly when chained after commands
            // like joinBackward that have already modified the document.
            const { $from } = tr.selection;
            const passageDepth = currentPassageDepth($from);
            if (passageDepth === null) return false;

            const passagePos = $from.start(passageDepth) - 1;
            const currentPassage = $from.node(passageDepth);
            const currentLabel = currentPassage.attrs.label as string;
            if (!currentLabel) return false;

            const currentParts = currentLabel.split('.');
            const numParts = currentParts.length;
            const currentPrefixWithDot =
              numParts > 1 ? currentParts.slice(0, -1).join('.') + '.' : '';

            const parentDepth = passageDepth - 1;
            if (parentDepth < 0) return false;

            const parentNode = $from.node(parentDepth);
            const startIndex = $from.index(parentDepth);

            let expectedNext = incrementLabel(currentLabel);
            let pos = passagePos + currentPassage.nodeSize;
            let changed = false;

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

              const targetParts = targetLabel.split('.');
              if (targetParts.length < numParts) break; // shallower → out of scope
              if (targetParts.length > numParts) {
                // deeper → skip sub-passage
                pos += child.nodeSize;
                continue;
              }
              if (!targetLabel.startsWith(currentPrefixWithDot)) break; // different prefix

              if (targetLabel === expectedNext) break; // already contiguous

              tr.setNodeMarkup(pos, null, { ...child.attrs, label: expectedNext });
              expectedNext = incrementLabel(expectedNext);
              changed = true;
              pos += child.nodeSize;
            }

            if (changed) dispatch(tr);
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
              uuid: crypto.randomUUID(),
              sort: oldAttrs.sort + 1,
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
  addKeyboardShortcuts() {
    return {
      Backspace: () =>
        this.editor.commands.first(({ commands }) => [
          () => commands.undoInputRule(),
          () => {
            // Only intercept at the very start of a passage's content
            const { $from } = this.editor.state.selection;
            const passageDepth = currentPassageDepth($from);
            if (passageDepth === null) return false;
            const isAtStart =
              $from.parentOffset === 0 && $from.index(passageDepth) === 0;
            if (!isAtStart) return false;
            const joined = commands.joinBackward();
            if (joined) commands.normalizeLabelsAfter();
            return joined;
          },
        ]),
      // Enter in an empty textblock that is a direct child of a passage
      // splits the passage at that block's boundary, dropping the empty
      // block, so pressing Enter twice at the end of a passage creates a
      // new one without leaving an empty paragraph behind.
      Enter: () => {
        const { state, view } = this.editor;
        const { selection, schema } = state;
        if (!selection.empty) return false;

        const { $from } = selection;
        const passageDepth = currentPassageDepth($from);
        if (passageDepth === null) return false;

        // Only trigger when the cursor's parent textblock is a direct child
        // of the passage — not nested inside a list, line group, table, etc.
        if ($from.depth !== passageDepth + 1) return false;
        if ($from.parent.content.size !== 0) return false;

        const passageNode = $from.node(passageDepth);
        // If the empty block is the only child, splitting would just produce
        // two empty passages — defer to default behavior.
        if (passageNode.childCount <= 1) return false;

        const passageStart = $from.start(passageDepth) - 1;
        const passageEnd = $from.end(passageDepth) + 1;
        const emptyChildIndex = $from.index(passageDepth);

        const beforeChildren = [];
        const afterChildren = [];
        for (let i = 0; i < passageNode.childCount; i++) {
          if (i < emptyChildIndex) beforeChildren.push(passageNode.child(i));
          if (i > emptyChildIndex) afterChildren.push(passageNode.child(i));
        }

        const passageType = schema.nodes.passage;
        const oldAttrs = passageNode.attrs;
        const newAttrs = {
          ...oldAttrs,
          uuid: crypto.randomUUID(),
          sort: oldAttrs.sort + 1,
          label: incrementLabel(oldAttrs.label),
        };

        // createAndFill auto-fills missing required content (e.g. an empty
        // afterContent gets a default paragraph) so the new passage is valid.
        const firstPassage = passageType.createAndFill(
          oldAttrs,
          Fragment.fromArray(beforeChildren),
        );
        const secondPassage = passageType.createAndFill(
          newAttrs,
          Fragment.fromArray(afterChildren),
        );
        if (!firstPassage || !secondPassage) return false;

        const tr = state.tr.replaceWith(passageStart, passageEnd, [
          firstPassage,
          secondPassage,
        ]);

        const newPassageContentStart = passageStart + firstPassage.nodeSize + 1;
        const $pos = tr.doc.resolve(newPassageContentStart);
        const newSelection =
          TextSelection.findFrom($pos, 1, true) ?? Selection.near($pos, 1);
        if (newSelection) tr.setSelection(newSelection);

        view.dispatch(tr);
        this.editor.commands.normalizeLabelsAfter();
        return true;
      },
    };
  },
});
