import type { Node, Mark } from '@tiptap/pm/model';
import { endNoteLink } from './end-note-link';

describe('endNoteLink exporter', () => {
  it('should export endNoteLink annotations correctly', () => {
    const node = {
      textContent: 'text',
    } as unknown as Node;

    const mark = {
      attrs: {
        notes: [
          {
            uuid: 'note-uuid-1',
            endNote: 'endnote-uuid-1',
          },
          {
            uuid: 'note-uuid-2',
            endNote: 'endnote-uuid-2',
          },
        ],
      },
    } as unknown as Mark;

    const result = endNoteLink({
      node,
      mark,
      parent: node,
      root: node,
      start: 10,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual([
      {
        uuid: 'note-uuid-1',
        passageUuid: 'passage-uuid-1234',
        type: 'endNoteLink',
        start: 14,
        end: 14,
        endNote: 'endnote-uuid-1',
      },
      {
        uuid: 'note-uuid-2',
        passageUuid: 'passage-uuid-1234',
        type: 'endNoteLink',
        start: 14,
        end: 14,
        endNote: 'endnote-uuid-2',
      },
    ]);
  });

  it('should return empty array when textContent is missing', () => {
    const node = {
      textContent: '',
    } as unknown as Node;

    const mark = {
      attrs: {
        notes: [
          {
            uuid: 'note-uuid-1',
            endNote: 'endnote-uuid-1',
          },
        ],
      },
    } as unknown as Mark;

    const result = endNoteLink({
      node,
      mark,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual([]);
  });

  it('should return empty array when notes are missing', () => {
    const node = {
      textContent: 'text',
    } as unknown as Node;

    const mark = {
      attrs: {
        notes: [],
      },
    } as unknown as Mark;

    const result = endNoteLink({
      node,
      mark,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual([]);
  });
});
