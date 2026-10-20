import { getBibliographyEntries, getBibliographyEntry } from './read';
import type { DataClient } from '../types';

const MARKED =
  '<p>Conze, <span class="comment-mark" type="comment" comment="t1" uuid="a1"><em>Large</em> Sutra</span></p>';
const PLAIN = '<p>Conze, <em>Large</em> Sutra</p>';

describe('bibliography reads', () => {
  it('leaves comment marks out of a work bibliography', async () => {
    const client = {
      rpc: async () => ({
        data: [
          { heading: 'Texts', entries: [{ uuid: 'r1', bibl_html: MARKED }] },
        ],
        error: null,
      }),
    } as unknown as DataClient;

    const entries = await getBibliographyEntries({ client, uuid: 'w1' });

    expect(entries[0].entries[0].html).toBe(PLAIN);
  });

  it('leaves comment marks out of one entry', async () => {
    const query = {
      select: () => query,
      eq: () => query,
      single: async () => ({
        data: { uuid: 'r1', work_uuid: 'w1', bibl_html: MARKED },
        error: null,
      }),
    };
    const client = { from: () => query } as unknown as DataClient;

    const entry = await getBibliographyEntry({ client, uuid: 'r1' });

    expect(entry?.html).toBe(PLAIN);
  });
});
