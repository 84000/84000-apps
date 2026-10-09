import { Editor } from '@tiptap/core';
import { parseMarkdown } from './markdown-codec';
import { createMarkdownExtensions } from './markdown-extensions';

/** Mounts a rich markdown editor on a detached element, for specs. */
export const mountMarkdown = (source: string): Editor =>
  new Editor({
    element: document.createElement('div'),
    extensions: createMarkdownExtensions(),
    content: parseMarkdown(source),
  });

/** ProseMirror's DOM observer, private but needed to read a DOM edit. */
type Observed = { domObserver: { flush: () => void } };

/**
 * Edits the editor's DOM text the way typing does, then has ProseMirror read
 * the change back. `edit` returns a text node's new value, or null to leave it
 * alone. Returns how many text nodes it changed.
 */
export const editTextNodes = (
  editor: Editor,
  edit: (text: string) => string | null,
): number => {
  const root = editor.view.dom;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    nodes.push(node as Text);
  }
  let edited = 0;
  for (const node of nodes) {
    const value = edit(node.nodeValue ?? '');
    if (value !== null && value !== node.nodeValue) {
      node.nodeValue = value;
      edited += 1;
    }
  }
  (editor.view as unknown as Observed).domObserver.flush();
  return edited;
};
