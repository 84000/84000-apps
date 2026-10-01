import { removeStackCommentAnchors } from './stack-comments';
import { createStackWorkDocument } from './stack-work';

// See PassageStackController.spec.ts — building the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const commented = (uuid: string, comment: string) => ({
  type: 'paragraph',
  attrs: { uuid },
  content: [
    { type: 'text', text: 'a ' },
    {
      type: 'text',
      text: 'noted',
      marks: [{ type: 'comment', attrs: { uuid: `anchor-${uuid}`, comment } }],
    },
    { type: 'text', text: ' word' },
  ],
});

const commentsIn = (
  work: ReturnType<typeof createStackWorkDocument>,
  uuid: string,
) => {
  const found: string[] = [];
  work.store
    .ensure(uuid)
    .toNode()
    .descendants((node) => {
      node.marks.forEach((mark) => found.push(mark.attrs.comment));
      return true;
    });
  return found;
};

describe('removeStackCommentAnchors', () => {
  it("takes a thread's anchors off every held passage, and only that thread's", () => {
    const work = createStackWorkDocument({ workUuid: 'w1' });
    work.seedSpine([
      { uuid: 'p1', label: '1', type: 'translation' },
      { uuid: 'p2', label: '2', type: 'translation' },
    ]);
    work.store.create('p1', [commented('a', 't1')]);
    work.store.create('p2', [commented('b', 't2')]);

    removeStackCommentAnchors(work, 't1');

    expect(commentsIn(work, 'p1')).toEqual([]);
    expect(work.store.ensure('p1').text).toBe('a noted word');
    expect(work.store.ensure('p1').isDirty).toBe(true);
    expect(commentsIn(work, 'p2')).toEqual(['t2']);
    expect(work.store.ensure('p2').isDirty).toBe(false);
  });
});
