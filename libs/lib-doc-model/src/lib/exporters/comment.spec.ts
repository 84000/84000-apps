import type { Node, Mark } from '@tiptap/pm/model';
import { comment } from './comment';

const node = { textContent: 'Buddha' } as unknown as Node;

const exportMark = (attrs: Record<string, unknown>, textContent = 'Buddha') =>
  comment({
    node: { textContent } as unknown as Node,
    mark: { attrs } as unknown as Mark,
    parent: node,
    root: node,
    start: 5,
    passageUuid: 'passage-uuid-1234',
  });

describe('comment exporter', () => {
  it('exports the anchor with the thread uuid', () => {
    expect(
      exportMark({
        uuid: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
        comment: 'f1e2d3c4-5678-90ab-cdef-fedcba098765',
      }),
    ).toEqual({
      uuid: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
      passageUuid: 'passage-uuid-1234',
      type: 'comment',
      start: 5,
      end: 11,
      comment: 'f1e2d3c4-5678-90ab-cdef-fedcba098765',
    });
  });

  it('returns undefined when the mark covers no text', () => {
    expect(
      exportMark(
        {
          uuid: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
          comment: 'f1e2d3c4-5678-90ab-cdef-fedcba098765',
        },
        '',
      ),
    ).toBeUndefined();
  });

  it('returns undefined when the thread uuid is missing', () => {
    expect(
      exportMark({ uuid: 'a1b2c3d4-5678-90ab-cdef-1234567890ab' }),
    ).toBeUndefined();
  });
});
