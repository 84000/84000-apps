import { applyWorkEdits } from './apply-work-edits';
import {
  WORK,
  createFakeClient,
  metadataWorld,
  snapshot,
} from './apply-work-edits.acceptance-fixture';
import type { DataClient } from '../types';

describe('applyWorkEdits upsert-passage range check', () => {
  it('refuses an annotation that ends past its passage content and writes nothing', async () => {
    const tables = metadataWorld();
    const before = snapshot(tables);
    const { client, world } = createFakeClient(tables);

    const result = await applyWorkEdits({
      client: client as unknown as DataClient,
      workUuid: WORK,
      ops: [
        { op: 'update-work', patch: { toh: 'toh44' } },
        {
          op: 'upsert-passage',
          passage: { label: '1', type: 'translation', content: 'Summary' },
          annotations: [{ kind: 'paragraph', start: 1, end: 8 }],
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.groups).toEqual([
      expect.objectContaining({ group: 'passages', applied: false }),
    ]);
    expect(result.notAttempted).toEqual(['work-metadata']);
    expect(world.writes).toEqual([]);
    expect(tables).toEqual(before);
  });
});
