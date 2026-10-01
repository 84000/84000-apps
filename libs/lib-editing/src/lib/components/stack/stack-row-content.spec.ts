import { ySyncPluginKey } from '@tiptap/y-tiptap';
import type { XmlElement, XmlText } from 'yjs';
import {
  PassageLoader,
  type WorkDocument,
} from '@eightyfourthousand/lib-doc-model';

import { PassageStackController } from './PassageStackController';
import { build, flush, hydrated, source } from './stack-controller.fixture';
import { createStackWorkDocument } from './stack-work';
import type { StackPassageSeed } from './types';

// See PassageStackController.spec.ts — building the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

/**
 * A text edit as a mounted editor would make it — written into the paragraph's
 * own `XmlText` under the y-sync origin, which is what makes the passage's
 * UndoManager treat it as the user's typing rather than a structural rewrite.
 */
const typeInto = (work: WorkDocument, uuid: string, text: string) => {
  const doc = work.store.peek(uuid);
  if (!doc) throw new Error(`passage ${uuid} is not hydrated`);
  doc.doc.transact(() => {
    const paragraph = doc.content.get(0) as XmlElement;
    (paragraph.get(0) as XmlText).insert(0, text);
  }, ySyncPluginKey);
};

describe('PassageStackController undo bookkeeping', () => {
  it('records a passage text edit in the work command log', async () => {
    const { work, controller } = await hydrated(3);
    expect(work.log.depth).toBe(0);

    typeInto(work, 'p1', 'hello ');

    // Nothing in the doc model calls recordTextEdit; the controller's wiring
    // is what puts typing into the same history as split and merge.
    expect(work.log.depth).toBe(1);
    expect(controller.undoDepth()).toBe(1);
  });

  it('interleaves text and structural entries in one history', async () => {
    const { work, controller } = await hydrated(3);
    typeInto(work, 'p0', 'edited ');
    work.merge('p1');

    expect(controller.undoDepth()).toBe(2);

    expect(controller.undo()).toBe(true);
    expect(work.spine.uuids()).toEqual(['p0', 'p1', 'p2']);
  });

  // Regression: structural undo used to restore a passage by clearing and
  // rebuilding its whole document, which destroyed the Yjs items the passage's
  // own UndoManager still pointed at. The text undo underneath then applied to
  // nothing — Yjs reported success, the history entry was consumed, and the
  // keystroke vanished. `PassageDoc.replaceContent` now diffs instead, so the
  // items either side of the change keep their identity.
  it('restores a text edit undone beneath a structural undo', async () => {
    const { work, controller } = await hydrated(3);
    typeInto(work, 'p0', 'edited ');
    work.merge('p1');
    expect(work.store.ensure('p0').text).toBe(
      'edited passage 0 textpassage 1 text',
    );

    expect(controller.undo()).toBe(true); // the merge
    expect(work.spine.uuids()).toEqual(['p0', 'p1', 'p2']);
    expect(work.store.ensure('p0').text).toBe('edited passage 0 text');

    expect(controller.undo()).toBe(true); // the typing beneath it
    expect(work.store.ensure('p0').text).toBe('passage 0 text');
    expect(work.log.depth).toBe(0);
  });

  it('does not re-record an edit while redoing it', async () => {
    const { work, controller } = await hydrated(3);
    typeInto(work, 'p0', 'edited ');

    controller.undo();
    controller.redo();

    // A redo pushes the item back onto the passage UndoManager's undo stack,
    // which fires the same event a fresh edit does. Recording that would
    // clear the redo branch and leave the log one entry too deep.
    expect(controller.undoDepth()).toBe(1);
    expect(work.store.ensure('p0').text).toBe('edited passage 0 text');
  });

  it('drops text history for a passage whose document was released', async () => {
    const { work, controller } = build(6);
    controller.setVisibleRange({ start: 0, end: 2 });
    await flush();

    typeInto(work, 'p0', 'edited ');
    expect(controller.undoDepth()).toBe(1);
    work.store.peek('p0')?.markSynced();

    controller.setVisibleRange({ start: 4, end: 6 });
    await flush();

    expect(work.store.has('p0')).toBe(false);
    expect(controller.undoDepth()).toBe(0);
  });
});

describe('PassageStackController static rendering', () => {
  /** A passage whose text carries an endnote-link mark, as the exporters make it. */
  const withEndNote = (): StackPassageSeed => ({
    meta: { uuid: 'p0', label: '1', type: 'translation' },
    content: [
      {
        type: 'paragraph',
        attrs: { uuid: 'para-1' },
        content: [
          {
            type: 'text',
            text: 'scripture',
            marks: [
              {
                type: 'endNoteLink',
                attrs: {
                  uuid: 'mark-1',
                  notes: [
                    {
                      uuid: 'note-1',
                      endNote: 'en-1',
                      label: '1',
                      location: 'end',
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
    charCount: 9,
  });

  // Regression: the static tier used to render with the stack's *schema* set,
  // whose extensions draw through React node views that produce nothing to a
  // string. Endnote markers were absent from every static row while the editor
  // showed them, and internal links rendered differently. Static rendering goes
  // through the reader's own renderer, which carries the `*.ssr` variants and
  // the endNoteLink mark mapping.
  it('renders endnote markers in a static row, as the reader does', async () => {
    const all = [withEndNote()];
    const work = createStackWorkDocument({
      workUuid: 'work-1',
      loader: new PassageLoader({ sources: [source(all)], buffer: 0 }),
    });
    work.seedSpine(all.map((entry) => entry.meta));
    const controller = new PassageStackController({ work });

    controller.setVisibleRange({ start: 0, end: 1 });
    await flush();

    const html = controller.getStaticHTML('p0');
    expect(html).toContain('class="end-note-link"');
    expect(html).toContain('endNote="en-1"');
  });
});
