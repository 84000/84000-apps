import { Plugin, PluginKey, Selection, TextSelection } from '@tiptap/pm/state';
import { Fragment, type Node as PMNode, ResolvedPos } from '@tiptap/pm/model';
import { incrementLabel } from '@eightyfourthousand/lib-doc-model';
import { PassageNodeSSR } from './PassageNode.ssr';
import {
  handleCompareSourceClipboard,
  syncPassageChrome,
} from './passage-chrome';
import { createPassageNodeView } from './passage-node-view';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    passage: {
      normalizeLabelsAfter: () => ReturnType;
      splitPassage: () => ReturnType;
      setPassageLabel: (uuid: string, label: string) => ReturnType;
    };
  }
}

export type PassageMenuPayload = {
  uuid: string;
  rect: {
    top: number;
    left: number;
    bottom: number;
    right: number;
    width: number;
    height: number;
  };
};

export type PassageChrome = {
  toh?: string;
  isCompare: boolean;
  bookmarkedUuids: Set<string>;
};

export type PassageStorage = {
  // Registered by the stable PassageMenuOverlay so the click plugin can open it.
  openMenu?: (payload: PassageMenuPayload) => void;
  navigateRef?: (ref: { uuid: string; type: string }) => void;
  // Navigation-derived state used to populate the compare-source / bookmark
  // chrome, plus a function (installed by the view plugin) to re-sync on demand.
  chrome?: PassageChrome;
  refreshChrome?: () => void;
};

declare module '@tiptap/core' {
  interface Storage {
    passage: PassageStorage;
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

export const PassageNode = PassageNodeSSR.extend({
  addStorage(): PassageStorage {
    return {
      openMenu: undefined,
      navigateRef: undefined,
      chrome: undefined,
      refreshChrome: undefined,
    };
  },

  addNodeView() {
    return createPassageNodeView;
  },

  addCommands() {
    return {
      normalizeLabelsAfter:
        () =>
        ({ dispatch, tr }) => {
          if (!dispatch) return true;

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
            if (targetParts.length < numParts) break;
            if (targetParts.length > numParts) {
              pos += child.nodeSize;
              continue;
            }
            if (!targetLabel.startsWith(currentPrefixWithDot)) break;

            if (targetLabel === expectedNext) break;

            tr.setNodeMarkup(pos, null, {
              ...child.attrs,
              label: expectedNext,
            });
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

          const passageDepth = currentPassageDepth($from);
          if (passageDepth === null) {
            return false;
          }

          const passageNode = $from.node(passageDepth);
          const passageStart = $from.start(passageDepth) - 1;
          const passageEnd = $from.end(passageDepth) + 1;

          const posInPassage = $from.pos - $from.start(passageDepth);

          const beforeContent = passageNode.content.cut(0, posInPassage);
          const afterContent = passageNode.content.cut(posInPassage);

          if (!dispatch) return true;

          const tr = state.tr;

          tr.replaceWith(
            passageStart,
            passageEnd,
            state.schema.nodes.passage.create(passageNode.attrs, beforeContent),
          );

          const newPassagePos = passageStart + beforeContent.size + 2;
          const oldAttrs = passageNode.attrs;
          const attrs = {
            ...oldAttrs,
            uuid: crypto.randomUUID(),
            sort: oldAttrs.sort + 1,
            label: incrementLabel(oldAttrs.label),
          };
          tr.insert(
            newPassagePos,
            state.schema.nodes.passage.create(attrs, afterContent),
          );

          const $pos = tr.doc.resolve(newPassagePos + 1);
          const newSelection =
            TextSelection.findFrom($pos, 1, true) || Selection.near($pos, 1);
          if (newSelection) {
            tr.setSelection(newSelection);
          }

          dispatch(tr);
          return true;
        },

      setPassageLabel:
        (uuid: string, label: string) =>
        ({ tr, state, dispatch }) => {
          let target: { pos: number; node: PMNode } | undefined;
          state.doc.descendants((node, pos) => {
            if (target) return false;
            if (node.type.name === 'passage' && node.attrs.uuid === uuid) {
              target = { pos, node };
              return false;
            }
            return true;
          });
          if (!target) return false;
          if (!dispatch) return true;
          tr.setNodeMarkup(target.pos, undefined, {
            ...target.node.attrs,
            label,
          });
          dispatch(tr);
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: new PluginKey('passageCompareSourceClipboard'),
        props: {
          handleDOMEvents: {
            copy: handleCompareSourceClipboard,
            cut: handleCompareSourceClipboard,
          },
        },
      }),

      // Opens the stable menu overlay when a passage label is pressed, and
      // routes reference-link clicks to navigation — without letting
      // ProseMirror move the selection (which previously remounted the view).
      new Plugin({
        key: new PluginKey('passageMenuClick'),
        props: {
          handleDOMEvents: {
            mousedown: (_view, event) => {
              const target = event.target as HTMLElement | null;
              if (!target) return false;

              const refEl = target.closest<HTMLElement>(
                '[data-passage-reference]',
              );
              if (refEl) {
                event.preventDefault();
                editor.storage.passage?.navigateRef?.({
                  uuid: refEl.getAttribute('data-ref-uuid') || '',
                  type: refEl.getAttribute('data-ref-type') || '',
                });
                return true;
              }

              const labelEl = target.closest<HTMLElement>(
                '[data-passage-label]',
              );
              if (labelEl) {
                event.preventDefault();
                const rect = labelEl.getBoundingClientRect();
                editor.storage.passage?.openMenu?.({
                  uuid: labelEl.getAttribute('data-uuid') || '',
                  rect: {
                    top: rect.top,
                    left: rect.left,
                    bottom: rect.bottom,
                    right: rect.right,
                    width: rect.width,
                    height: rect.height,
                  },
                });
                return true;
              }

              return false;
            },
          },
        },
      }),

      // Syncs the compare-source text and bookmark icon (chrome that lives
      // outside the editable content) from navigation state.
      new Plugin({
        key: new PluginKey('passageChrome'),
        view: (editorView) => {
          const run = (force: boolean) =>
            syncPassageChrome(editorView, editor, force);
          run(true);
          editor.storage.passage.refreshChrome = () => run(true);
          return {
            update: () => run(false),
            destroy: () => {
              if (editor.storage.passage) {
                editor.storage.passage.refreshChrome = undefined;
              }
            },
          };
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () =>
        this.editor.commands.first(({ commands }) => [
          () => commands.undoInputRule(),
          () => {
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
      Enter: () => {
        const { state, view } = this.editor;
        const { selection, schema } = state;
        if (!selection.empty) return false;

        const { $from } = selection;
        const passageDepth = currentPassageDepth($from);
        if (passageDepth === null) return false;

        if ($from.depth !== passageDepth + 1) return false;
        if ($from.parent.content.size !== 0) return false;

        const passageNode = $from.node(passageDepth);
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

export default PassageNode;
