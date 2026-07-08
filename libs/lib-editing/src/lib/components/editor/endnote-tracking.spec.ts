import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import {
  collectPassageUuidsByType,
  diffPassageUuidsByType,
} from './endnote-tracking';

const fakeDoc = (
  children: Array<{ type: string; uuid?: string; passageType?: string }>,
): ProseMirrorNode =>
  ({
    childCount: children.length,
    child: (i: number) => ({
      type: { name: children[i].type },
      attrs: { uuid: children[i].uuid, type: children[i].passageType },
    }),
  }) as unknown as ProseMirrorNode;

describe('collectPassageUuidsByType', () => {
  it('groups passage uuids by type and skips non-passages and uuid-less nodes', () => {
    const doc = fakeDoc([
      { type: 'passage', uuid: 'e-1', passageType: 'endnotes' },
      { type: 'passage', uuid: 'e-2', passageType: 'endnotes' },
      { type: 'passage', uuid: 'h-1', passageType: 'endnotesHeader' },
      { type: 'passage', passageType: 'endnotes' },
      { type: 'paragraph', uuid: 'not-a-passage' },
    ]);

    const byType = collectPassageUuidsByType(doc);

    expect(Array.from(byType['endnotes'])).toEqual(['e-1', 'e-2']);
    expect(Array.from(byType['endnotesHeader'])).toEqual(['h-1']);
    expect(Object.keys(byType)).toHaveLength(2);
  });

  it('defaults missing passage types to unknown', () => {
    const doc = fakeDoc([{ type: 'passage', uuid: 'p-1' }]);

    expect(Array.from(collectPassageUuidsByType(doc)['unknown'])).toEqual([
      'p-1',
    ]);
  });
});

describe('diffPassageUuidsByType', () => {
  const byType = (entries: Record<string, string[]>) =>
    Object.fromEntries(
      Object.entries(entries).map(([key, uuids]) => [key, new Set(uuids)]),
    );

  it('reports deletions per type', () => {
    const { deletedByType, hasAdded } = diffPassageUuidsByType(
      byType({ endnotes: ['e-1', 'e-2'] }),
      byType({ endnotes: ['e-2'] }),
    );

    expect(deletedByType).toEqual({ endnotes: ['e-1'] });
    expect(hasAdded).toBe(false);
  });

  it('accumulates all deletions in a burst against the pre-burst baseline', () => {
    // Two deletions happened across the debounce window; one diff against
    // the pre-burst baseline reports both.
    const { deletedByType } = diffPassageUuidsByType(
      byType({ endnotes: ['e-1', 'e-2', 'e-3'] }),
      byType({ endnotes: ['e-2'] }),
    );

    expect(deletedByType['endnotes'].sort()).toEqual(['e-1', 'e-3']);
  });

  it('reports additions without listing them', () => {
    const { deletedByType, hasAdded } = diffPassageUuidsByType(
      byType({ endnotes: ['e-1'] }),
      byType({ endnotes: ['e-1', 'e-2'] }),
    );

    expect(deletedByType).toEqual({});
    expect(hasAdded).toBe(true);
  });

  it('treats a vanished type as deletions and a new type as additions', () => {
    const { deletedByType, hasAdded } = diffPassageUuidsByType(
      byType({ endnotes: ['e-1'] }),
      byType({ endnotesHeader: ['h-1'] }),
    );

    expect(deletedByType).toEqual({ endnotes: ['e-1'] });
    expect(hasAdded).toBe(true);
  });

  it('reports no changes for identical sets', () => {
    const { deletedByType, hasAdded } = diffPassageUuidsByType(
      byType({ endnotes: ['e-1'] }),
      byType({ endnotes: ['e-1'] }),
    );

    expect(deletedByType).toEqual({});
    expect(hasAdded).toBe(false);
  });
});
