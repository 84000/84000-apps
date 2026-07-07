import type { Editor } from '@tiptap/core';
import { Plugin, PluginKey, Selection, TextSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { Fragment, type Node as PMNode, ResolvedPos } from '@tiptap/pm/model';
import { incrementLabel } from './label';
import { PassageNodeSSR } from './PassageNode.ssr';
import {
  PASSAGE_CONTENT_CLASS,
  PASSAGE_INNER_CLASS,
  PASSAGE_LABEL_CLASS,
  PASSAGE_REFERENCES_CLASS,
  PASSAGE_WRAPPER_CLASS,
} from './classes';

type PassageReference = {
  uuid: string;
  label: string | null;
  sort: number;
  type: string;
};

const BOOKMARK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-accent size-3"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>';

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

// True when the current native (browser) selection sits inside the read-only
// Tibetan compare source, which is rendered outside ProseMirror's content DOM.
const selectionInCompareSource = () => {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.focusNode) {
    return false;
  }
  const node = selection.focusNode;
  const el = node.nodeType === 3 ? node.parentElement : (node as HTMLElement);
  return !!el?.closest('[data-compare-source]');
};

// Returning true makes ProseMirror skip its own copy/cut handling (without
// calling preventDefault), so the browser's native clipboard behavior runs and
// copies the selected Tibetan text.
const handleCompareSourceClipboard = () => selectionInCompareSource();

const compareLeadingSpaceClass = (node: PMNode): string => {
  const firstChild = node.content.firstChild;
  if (firstChild?.attrs.hasLeadingSpace) return 'md:mt-5';
  if (['lineGroup', 'list'].includes(firstChild?.type.name || '')) {
    return 'md:mt-2';
  }
  return 'md:mt-1';
};

// Imperatively populates the per-passage chrome (compare-mode Tibetan source and
// the reader bookmark icon) that lives outside ProseMirror's editable content.
// Driven by editor.storage.passage.chrome, refreshed on transactions and on
// explicit navigation changes (via refreshChrome).
const syncPassageChrome = (view: EditorView, editor: Editor, force = false) => {
  const chrome = editor.storage.passage?.chrome;
  const toh = chrome?.toh;
  const isCompare = !!chrome?.isCompare;
  const bookmarked = chrome?.bookmarkedUuids ?? new Set<string>();
  const editable = editor.isEditable;

  const needsWork = isCompare || (!editable && bookmarked.size > 0);
  if (!needsWork && !force) return;

  view.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'passage') return true;
    const dom = view.nodeDOM(pos);
    if (!dom || dom.nodeType !== 1) return false;
    const el = dom as HTMLElement;

    // Writes here mutate the node's DOM, which ProseMirror's mutation observer
    // watches — so only touch the DOM when the desired state actually differs,
    // otherwise redundant writes trigger an update→mutate→update feedback loop.
    const csDiv = el.querySelector<HTMLElement>(
      ':scope > .passage-compare-source',
    );
    const csText = csDiv?.querySelector<HTMLElement>('.passage-compare-text');
    if (csDiv && csText) {
      const alignment = node.attrs.alignments?.[toh ?? ''] as
        | { tibetan?: string }
        | undefined;
      const tibetan = isCompare && toh ? (alignment?.tibetan ?? '').trim() : '';
      if (csText.textContent !== tibetan) csText.textContent = tibetan;
      const shouldHide = !tibetan;
      if (csDiv.classList.contains('hidden') !== shouldHide) {
        csDiv.classList.toggle('hidden', shouldHide);
      }
      const leading = tibetan ? compareLeadingSpaceClass(node) : 'md:mt-1';
      for (const cls of ['md:mt-1', 'md:mt-2', 'md:mt-5']) {
        const want = cls === leading;
        if (csDiv.classList.contains(cls) !== want) {
          csDiv.classList.toggle(cls, want);
        }
      }
    }

    const bm = el.querySelector<HTMLElement>(':scope .passage-bookmark');
    if (bm) {
      const uuid = node.attrs.uuid as string | undefined;
      const show = !editable && !!uuid && bookmarked.has(uuid);
      if (bm.classList.contains('hidden') === show) {
        bm.classList.toggle('hidden', !show);
      }
    }

    return false;
  });
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

  // A plain DOM node view (no React) — so interacting with a passage never
  // remounts a React tree the way the old ReactNodeViewRenderer did. The
  // interactive menu/dialogs live in the stable PassageMenuOverlay; the
  // compare-source / bookmark chrome is built here and populated by the view
  // plugin in addProseMirrorPlugins. ignoreMutation shields that chrome from
  // ProseMirror's mutation observer so syncing it never triggers a reparse loop.
  addNodeView() {
    return ({ node }) => {
      let current = node;

      const wrapper = document.createElement('div');
      wrapper.className = PASSAGE_WRAPPER_CLASS;

      const applyWrapperAttrs = (n: PMNode) => {
        if (n.attrs.uuid) wrapper.id = n.attrs.uuid;
        if (n.attrs.toh) wrapper.setAttribute('data-toh', n.attrs.toh);
        else wrapper.removeAttribute('data-toh');
        if (n.attrs.type) wrapper.setAttribute('data-passage-type', n.attrs.type);
        else wrapper.removeAttribute('data-passage-type');
        if (n.attrs.invalid) wrapper.setAttribute('data-invalid', 'true');
        else wrapper.removeAttribute('data-invalid');
      };
      applyWrapperAttrs(node);

      const column = document.createElement('div');
      column.className = 'w-full';
      const inner = document.createElement('div');
      inner.className = PASSAGE_INNER_CLASS;

      // Label doubles as the dropdown trigger (handled by the click plugin).
      const label = document.createElement('div');
      label.className = PASSAGE_LABEL_CLASS;
      label.setAttribute('contenteditable', 'false');
      label.setAttribute('data-passage-label', '');
      if (node.attrs.uuid) label.setAttribute('data-uuid', node.attrs.uuid);
      label.textContent = node.attrs.label || '';

      const bookmark = document.createElement('div');
      bookmark.className =
        'passage-bookmark hidden absolute -left-15.75 top-6 w-16 flex justify-end';
      bookmark.setAttribute('contenteditable', 'false');
      bookmark.innerHTML = BOOKMARK_SVG;

      const content = document.createElement('div');
      content.className = PASSAGE_CONTENT_CLASS;
      // Off-screen passage content skips layout and paint entirely; the
      // ProseMirror data model is untouched, so Yjs sync, dirty tracking,
      // and save are unaffected. `auto` intrinsic sizing remembers the last
      // rendered height (with a pre-first-render estimate) so scroll
      // position stays stable as passages enter and leave the viewport.
      // Applied to the content hole rather than the wrapper: the label and
      // bookmark hang in the left gutter via negative offsets, and the paint
      // containment content-visibility implies would clip them.
      content.style.contentVisibility = 'auto';
      content.style.containIntrinsicSize = 'auto 8rem';

      inner.append(label, bookmark, content);

      const buildReferences = (n: PMNode): HTMLElement | null => {
        const references = (n.attrs.references ?? []) as PassageReference[];
        if (!references.length) return null;
        const div = document.createElement('div');
        div.className = PASSAGE_REFERENCES_CLASS;
        div.setAttribute('contenteditable', 'false');
        references.forEach((ref, index) => {
          if (index > 0) div.append(document.createTextNode(', '));
          const a = document.createElement('a');
          a.href = `#${ref.uuid}`;
          a.setAttribute('data-passage-reference', '');
          a.setAttribute('data-ref-uuid', ref.uuid);
          a.setAttribute('data-ref-type', ref.type);
          a.textContent = ref.label || ref.uuid.slice(0, 6);
          div.append(a);
        });
        return div;
      };
      let referencesEl = buildReferences(node);
      if (referencesEl) inner.append(referencesEl);

      column.append(inner);

      // Second flex column: compare-mode Tibetan source (hidden until synced).
      const compare = document.createElement('div');
      compare.className = 'passage-compare-source w-full hidden md:mt-1';
      compare.setAttribute('contenteditable', 'false');
      compare.setAttribute('data-compare-source', '');
      const compareInner = document.createElement('div');
      compareInner.className = 'passage pl-6 @c/sidebar:pl-4';
      const compareText = document.createElement('div');
      compareText.className =
        'passage-compare-text leading-7 font-tibetan text-lg whitespace-normal mt-1.5 pb-4 md:pb-2';
      compareInner.append(compareText);
      compare.append(compareInner);

      wrapper.append(column, compare);

      return {
        dom: wrapper,
        contentDOM: content,
        update: (updated: PMNode) => {
          if (updated.type.name !== 'passage') return false;
          applyWrapperAttrs(updated);

          const nextLabel = updated.attrs.label || '';
          if (label.textContent !== nextLabel) label.textContent = nextLabel;
          const nextUuid = (updated.attrs.uuid as string) || '';
          if (label.getAttribute('data-uuid') !== nextUuid) {
            label.setAttribute('data-uuid', nextUuid);
          }

          const prevRefs = JSON.stringify(current.attrs.references ?? []);
          const nextRefs = JSON.stringify(updated.attrs.references ?? []);
          if (prevRefs !== nextRefs) {
            referencesEl?.remove();
            referencesEl = buildReferences(updated);
            if (referencesEl) inner.append(referencesEl);
          }

          current = updated;
          return true;
        },
        // Ignore everything in the non-editable chrome (label/bookmark/compare
        // source) and defer to ProseMirror only for the editable content hole.
        // This must include selection-type records: ignoring them leaves the
        // browser's native selection in place so the Tibetan compare source can
        // be selected/copied, instead of ProseMirror pulling the selection back
        // into the editable content. It also keeps the view plugin's chrome
        // writes from triggering a mutation→reparse loop.
        ignoreMutation: (mutation: MutationRecord | { type: string }) => {
          const target = (mutation as MutationRecord).target as Node | null;
          return !target || !content.contains(target);
        },
      };
    };
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
