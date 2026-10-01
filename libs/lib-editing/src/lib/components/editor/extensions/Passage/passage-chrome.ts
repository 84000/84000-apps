import type { Editor } from '@tiptap/core';
import type { EditorView } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';

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
export const handleCompareSourceClipboard = () => selectionInCompareSource();

const compareLeadingSpaceClass = (node: PMNode): string => {
  const firstChild = node.content.firstChild;
  if (firstChild?.attrs.leadingSpace) return 'md:mt-5';
  if (['lineGroup', 'list'].includes(firstChild?.type.name || '')) {
    return 'md:mt-2';
  }
  return 'md:mt-1';
};

// Imperatively populates the per-passage chrome (compare-mode Tibetan source and
// the reader bookmark icon) that lives outside ProseMirror's editable content.
// Driven by editor.storage.passage.chrome, refreshed on transactions and on
// explicit navigation changes (via refreshChrome).
export const syncPassageChrome = (
  view: EditorView,
  editor: Editor,
  force = false,
) => {
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
