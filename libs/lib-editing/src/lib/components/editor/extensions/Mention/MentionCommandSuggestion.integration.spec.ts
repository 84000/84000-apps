import { Editor, Extension, Node, Range } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import {
  mentionSuggestion,
  mentionSuggestionPluginKey,
} from './MentionSuggestion';
import { MentionCommandSuggestion } from './MentionCommandSuggestion';

// MentionSuggestion imports MentionList for its popup, which reaches
// lib-search -> data-access/ssr -> next/server and needs a `Request` global
// jsdom does not provide. The list is irrelevant here — this asserts on plugin
// state, which `apply` computes before any rendering — so stub it out and keep
// the real suggestion config (char, allowSpaces, allowedPrefixes) under test.
// Hoisted above the imports above by the jest transform.
jest.mock('./MentionList', () => ({ __esModule: true, default: () => null }));

const Doc = Node.create({ name: 'doc', topNode: true, content: 'block+' });
const Paragraph = Node.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',
  parseHTML: () => [{ tag: 'p' }],
  renderHTML: () => ['p', 0],
});
const TextNode = Node.create({ name: 'text', group: 'inline' });

/**
 * Drives the real `mentionSuggestion` config — its `char`, `allowSpaces`, and
 * default `allowedPrefixes` are the parts under test. Only `render` is stubbed,
 * to keep tippy and the React renderer out of jsdom; the plugin state this
 * asserts on is computed in `apply`, before `render` is consulted.
 */
const MentionTrigger = Extension.create({
  name: 'mentionTrigger',
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...mentionSuggestion,
        render: () => ({}),
      }),
    ];
  },
});

const createEditor = (html: string) =>
  new Editor({
    element: document.createElement('div'),
    extensions: [Doc, Paragraph, TextNode, MentionTrigger],
    content: html,
  });

const suggestionState = (editor: Editor) =>
  mentionSuggestionPluginKey.getState(editor.state);

describe('MentionCommandSuggestion end to end', () => {
  it('leaves the mention dropdown open where the slash trigger was', () => {
    const editor = createEditor('<p>see /mention</p>');
    // "see /mention" starts at pos 1, so the slash sits at 5 and the trigger
    // text runs to 13 — the range the slash plugin would hand the command.
    expect(editor.state.doc.textContent).toBe('see /mention');
    const range: Range = { from: 5, to: 13 };

    // No caret placed: the command must target range.from itself rather than
    // inherit wherever the selection happens to sit.
    expect(suggestionState(editor)?.active).toBe(false);

    MentionCommandSuggestion.command({ editor, range });

    const state = suggestionState(editor);
    expect(state?.active).toBe(true);
    // Empty query: the dropdown opens in its "Type to search entities…" state,
    // exactly as it does for a hand-typed `@`.
    expect(state?.query).toBe('');
    expect(state?.range).toEqual({ from: 5, to: 6 });
    expect(editor.state.doc.textContent).toBe('see @');

    editor.destroy();
  });

  it('does not open when the slash trigger is mid-word', () => {
    // allowedPrefixes defaults to [' '], so a trigger glued to a preceding word
    // is refused — the same rule that governs a typed `@`.
    const editor = createEditor('<p>see/mention</p>');

    MentionCommandSuggestion.command({ editor, range: { from: 4, to: 12 } });

    expect(suggestionState(editor)?.active).toBe(false);
    editor.destroy();
  });

  it('carries a multi-word query, since the config allows spaces', () => {
    // Relevant to seeding the dropdown from a selection: allowSpaces means the
    // query survives the first space instead of ending the match there.
    const editor = createEditor('<p>see</p>');
    // Built by typing rather than parsed from HTML: the parser trims a trailing
    // space, and the space before `@` is what allowedPrefixes requires.
    editor
      .chain()
      .focus()
      .setTextSelection(4)
      .insertContent(' @the Great Vehicle')
      .run();

    const state = suggestionState(editor);
    expect(state?.active).toBe(true);
    expect(state?.query).toBe('the Great Vehicle');

    editor.destroy();
  });
});
