import { getSchema } from '@tiptap/core';
import { EditorState, PluginKey, Selection } from '@tiptap/pm/state';
import { renderToHTMLString } from '@tiptap/static-renderer/pm/html-string';
import { Doc } from 'yjs';
import { ANNOTATION_TOH_TYPES } from '@eightyfourthousand/lib-doc-model';

import { slashCommandPluginKey } from '../editor/extensions/SlashCommand/SlashCommand';
import { mentionSuggestionPluginKey } from '../editor/extensions/Mention/MentionSuggestion';
import { BoundaryKeymap } from './BoundaryKeymap';
import {
  buildStackEditorExtensions,
  buildStackSchemaExtensions,
} from './stack-extensions';
import type { StackKeyboardDelegate } from './types';

// See PassageStackController.spec.ts — building the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const delegate = (): StackKeyboardDelegate => ({
  focusRelative: () => false,
  splitAtSelection: () => false,
  mergeWithPrevious: () => false,
  undo: () => false,
  redo: () => false,
});

const editorExtensions = () => {
  const doc = new Doc();
  const passage = doc.getXmlFragment('content');
  return buildStackEditorExtensions({
    uuid: 'p0',
    fragment: passage,
    undoManager: { destroy: () => undefined } as never,
    delegate: delegate(),
  });
};

const names = (extensions: ReturnType<typeof buildStackSchemaExtensions>) =>
  extensions.map((extension) => extension.name);

describe('stack schema extensions', () => {
  it('replaces the passage wrapper with a single-passage top node', () => {
    const list = names(buildStackSchemaExtensions());

    // Passage identity lives in the spine, so there is no passage node and no
    // translation document wrapping a whole panel.
    expect(list).not.toContain('passage');
    expect(list).not.toContain('translationDocument');
    expect(list).toContain('doc');
  });

  it('declares a toh scope on every annotation-bearing type', () => {
    const schema = getSchema(buildStackSchemaExtensions());

    const missing = ANNOTATION_TOH_TYPES.filter((type) => {
      const spec = schema.nodes[type]?.spec ?? schema.marks[type]?.spec;
      return !spec?.attrs || !('toh' in spec.attrs);
    });

    expect(missing).toEqual([]);
  });

  // `AnnotationToh` is not what carries a toh scope — `TranslationMetadata`
  // already declares `toh` on every type, so the value round-trips without it.
  // What it adds is the rendered `data-toh`, which is the attribute the
  // reader's toh-visibility rule reads. Without it a passage scoped to an
  // inactive Tohoku text renders `toh=` in the static tier and cannot be
  // hidden.
  it('renders a toh scope as data-toh in the static tier', () => {
    const html = renderToHTMLString({
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { uuid: 'a', toh: 'toh417' },
            content: [{ type: 'text', text: 'scoped' }],
          },
        ],
      },
      extensions: buildStackSchemaExtensions(),
    });

    expect(html).toContain('data-toh="toh417"');
  });

  it('carries no editor-only commands, so parsing cannot depend on them', () => {
    const list = names(buildStackSchemaExtensions());

    // The schema set feeds `PassageDoc` and the static renderer as well as the
    // editors; a plugin in here would be loaded in contexts that have no view.
    expect(list).not.toContain('slashCommand');
    expect(list).not.toContain('abbreviationCommand');
  });
});

describe('stack editor extensions', () => {
  it('adds the slash menu and its abbreviation command on top of the schema', () => {
    const list = names(editorExtensions());

    expect(list).toContain('slashCommand');
    expect(list).toContain('abbreviationCommand');
    expect(list).toContain('collaboration');
    expect(list).toContain('boundaryKeymap');
  });

  it('routes the slash menu Passage item to the spine, not to splitPassage', () => {
    const calls: string[] = [];
    const stackDelegate: StackKeyboardDelegate = {
      ...delegate(),
      splitAtSelection: (uuid) => {
        calls.push(uuid);
        return true;
      },
    };

    const doc = new Doc();
    const extensions = buildStackEditorExtensions({
      uuid: 'p7',
      fragment: doc.getXmlFragment('content'),
      undoManager: { destroy: () => undefined } as never,
      delegate: stackDelegate,
    });

    const slash = extensions.find((e) => e.name === 'slashCommand');
    const items = slash?.options.suggestion.items({
      query: 'passage',
      editor: { storage: { mention: {} } },
    });
    expect(items).toHaveLength(1);

    // `splitPassage` and `normalizeLabelsAfter` are PassageNode commands this
    // model does not have; a split is a spine operation.
    const chain = {
      deleteRange: () => chain,
      run: () => true,
    };
    items[0].command({
      editor: { chain: () => chain },
      range: { from: 0, to: 1 },
    });

    expect(calls).toEqual(['p7']);
  });
});

describe('BoundaryKeymap suggestion guard', () => {
  const shortcuts = (delegate: StackKeyboardDelegate) =>
    (
      BoundaryKeymap.config.addKeyboardShortcuts as (this: {
        options: { uuid: string; delegate: StackKeyboardDelegate };
      }) => Record<string, (props: { editor: unknown }) => boolean>
    ).call({ options: { uuid: 'p0', delegate } });

  /**
   * `PluginKey.getState(state)` reads `state[key.key]`, and that property is
   * runtime-only — it is absent from prosemirror's published types.
   */
  const stateKey = (key: PluginKey) => (key as unknown as { key: string }).key;

  /** An editor whose doc is one empty paragraph, caret at the end. */
  const fakeEditor = (suggestionActive: boolean) => {
    const pluginState = suggestionActive ? { active: true } : { active: false };
    return {
      state: {
        [stateKey(slashCommandPluginKey)]: pluginState,
        [stateKey(mentionSuggestionPluginKey)]: { active: false },
        selection: { empty: true, $from: { pos: 1, index: () => 0 } },
        doc: { childCount: 1, content: { size: 2 } },
      },
      view: { endOfTextblock: () => true },
    };
  };

  // Regression: this extension runs at priority 1000, ahead of the suggestion
  // plugins. Enter used to split the passage while the slash menu was open,
  // instead of choosing the highlighted item — which left the `/passage`
  // trigger text behind in the head passage. Verified in a browser against
  // toh145 before and after.
  it('yields Enter and the arrows while a suggestion menu is open', () => {
    const calls: string[] = [];
    const delegate: StackKeyboardDelegate = {
      focusRelative: () => (calls.push('focusRelative'), true),
      splitAtSelection: () => (calls.push('split'), true),
      mergeWithPrevious: () => true,
      undo: () => true,
      redo: () => true,
    };
    const keys = shortcuts(delegate);
    const editor = fakeEditor(true);

    expect(keys['Enter']({ editor })).toBe(false);
    expect(keys['ArrowUp']({ editor })).toBe(false);
    expect(keys['ArrowDown']({ editor })).toBe(false);
    expect(keys['Mod-Enter']({ editor })).toBe(false);
    expect(calls).toEqual([]);
  });

  it('still splits on Enter at the end of a passage with no menu open', () => {
    const calls: string[] = [];
    const delegate: StackKeyboardDelegate = {
      focusRelative: () => true,
      splitAtSelection: () => (calls.push('split'), true),
      mergeWithPrevious: () => true,
      undo: () => true,
      redo: () => true,
    };

    // A real state, because `atDocEnd` resolves `Selection.atEnd` against the
    // document. No suggestion plugins are installed, so the guard reads them as
    // closed — which is the case being covered.
    const schema = getSchema(buildStackSchemaExtensions());
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('text')]),
    ]);
    let state = EditorState.create({ doc });
    state = state.apply(state.tr.setSelection(Selection.atEnd(state.doc)));

    expect(shortcuts(delegate)['Enter']({ editor: { state } })).toBe(true);
    expect(calls).toEqual(['split']);
  });
});
