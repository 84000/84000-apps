import type { NodeViewRenderer } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { PassageReference } from './PassageNode.ssr';
import {
  PASSAGE_CONTENT_CLASS,
  PASSAGE_INNER_CLASS,
  PASSAGE_LABEL_CLASS,
  PASSAGE_REFERENCES_CLASS,
  PASSAGE_WRAPPER_CLASS,
} from './classes';

const BOOKMARK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-accent size-3"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>';

/**
 * A plain DOM node view (no React) — so interacting with a passage never
 * remounts a React tree the way the old ReactNodeViewRenderer did. The
 * interactive menu/dialogs live in the stable PassageMenuOverlay; the
 * compare-source / bookmark chrome is built here and populated by the view
 * plugin in addProseMirrorPlugins. ignoreMutation shields that chrome from
 * ProseMirror's mutation observer so syncing it never triggers a reparse loop.
 */
export const createPassageNodeView: NodeViewRenderer = ({ node }) => {
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

  inner.append(label, bookmark, content);

  const buildReferences = (n: PMNode): HTMLElement | null => {
    const references = (n.attrs.references ?? []) as PassageReference[];
    if (!references.length) return null;
    const div = document.createElement('div');
    div.className = PASSAGE_REFERENCES_CLASS;
    div.setAttribute('contenteditable', 'false');
    references.forEach((ref) => {
      const a = document.createElement('a');
      a.href = `#${ref.uuid}`;
      a.setAttribute('data-passage-reference', '');
      a.setAttribute('data-ref-uuid', ref.uuid);
      a.setAttribute('data-ref-type', ref.type);
      ref.toh && a.setAttribute('data-toh', ref.toh);
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
