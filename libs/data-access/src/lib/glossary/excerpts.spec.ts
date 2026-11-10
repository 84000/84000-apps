import {
  GLOSSARY_EXCERPT_MAX_LENGTH,
  cutGlossaryExcerpt,
  getGlossaryTermExcerpts,
} from './excerpts';
import type { DataClient } from '../types';

const words = (count: number, word = 'lorem') =>
  Array.from({ length: count }, () => word).join(' ');

const shownLength = (excerpt: ReturnType<typeof cutGlossaryExcerpt>) =>
  excerpt.text.length +
  (excerpt.truncatedStart ? 1 : 0) +
  (excerpt.truncatedEnd ? 1 : 0);

const highlighted = (excerpt: ReturnType<typeof cutGlossaryExcerpt>) =>
  excerpt.highlights.map(({ start, end }) => excerpt.text.slice(start, end));

describe('cutGlossaryExcerpt', () => {
  it('shows a short passage whole, highlighting every instance', () => {
    const content = 'The bodhisattva met another bodhisattva.';
    const excerpt = cutGlossaryExcerpt(content, [
      { start: 28, end: 39 },
      { start: 4, end: 15 },
    ]);

    expect(excerpt.text).toBe(content);
    expect(excerpt.truncatedStart).toBe(false);
    expect(excerpt.truncatedEnd).toBe(false);
    expect(highlighted(excerpt)).toEqual(['bodhisattva', 'bodhisattva']);
  });

  it('cuts a long passage around its first instance within the limit', () => {
    const content = `${words(100)} TERM ${words(100)} TERM ${words(100)}`;
    const first = content.indexOf('TERM');
    const second = content.lastIndexOf('TERM');
    const excerpt = cutGlossaryExcerpt(content, [
      { start: second, end: second + 4 },
      { start: first, end: first + 4 },
    ]);

    expect(shownLength(excerpt)).toBeLessThanOrEqual(
      GLOSSARY_EXCERPT_MAX_LENGTH,
    );
    expect(excerpt.truncatedStart).toBe(true);
    expect(excerpt.truncatedEnd).toBe(true);
    expect(highlighted(excerpt)).toEqual(['TERM']);
    // Cut between words, not inside one.
    expect(excerpt.text.startsWith('lorem')).toBe(true);
    expect(excerpt.text.endsWith('lorem')).toBe(true);
  });

  it('highlights every instance that falls inside the window', () => {
    const content = `${words(100)} TERM and TERM ${words(100)}`;
    const first = content.indexOf('TERM');
    const second = content.indexOf('TERM', first + 1);
    const excerpt = cutGlossaryExcerpt(content, [
      { start: first, end: first + 4 },
      { start: second, end: second + 4 },
    ]);

    expect(highlighted(excerpt)).toEqual(['TERM', 'TERM']);
  });

  it('marks only the cut end when the instance is near the start', () => {
    const content = `TERM ${words(200)}`;
    const excerpt = cutGlossaryExcerpt(content, [{ start: 0, end: 4 }]);

    expect(excerpt.truncatedStart).toBe(false);
    expect(excerpt.truncatedEnd).toBe(true);
    expect(excerpt.text.startsWith('TERM')).toBe(true);
    expect(shownLength(excerpt)).toBeLessThanOrEqual(
      GLOSSARY_EXCERPT_MAX_LENGTH,
    );
  });

  it('marks only the cut start when the instance is near the end', () => {
    const content = `${words(200)} TERM`;
    const start = content.length - 4;
    const excerpt = cutGlossaryExcerpt(content, [
      { start, end: content.length },
    ]);

    expect(excerpt.truncatedStart).toBe(true);
    expect(excerpt.truncatedEnd).toBe(false);
    expect(excerpt.text.endsWith('TERM')).toBe(true);
  });

  it('cuts an instance longer than the window', () => {
    const content = 'x'.repeat(1000);
    const excerpt = cutGlossaryExcerpt(content, [{ start: 10, end: 900 }]);

    expect(shownLength(excerpt)).toBeLessThanOrEqual(
      GLOSSARY_EXCERPT_MAX_LENGTH,
    );
    expect(excerpt.highlights).toEqual([
      { start: 0, end: excerpt.text.length },
    ]);
  });

  it('merges overlapping instances into one highlight', () => {
    const excerpt = cutGlossaryExcerpt('one two three', [
      { start: 0, end: 7 },
      { start: 4, end: 13 },
    ]);

    expect(excerpt.highlights).toEqual([{ start: 0, end: 13 }]);
  });

  it('counts offsets in UTF-16 units and never splits a surrogate pair', () => {
    const astral = '\u{1F600}';
    const content = `${astral.repeat(200)} TERM ${astral.repeat(200)}`;
    const start = content.indexOf('TERM');
    const excerpt = cutGlossaryExcerpt(content, [{ start, end: start + 4 }]);

    expect(highlighted(excerpt)).toEqual(['TERM']);
    const first = excerpt.text.charCodeAt(0);
    const last = excerpt.text.charCodeAt(excerpt.text.length - 1);
    expect(first >= 0xdc00 && first <= 0xdfff).toBe(false);
    expect(last >= 0xd800 && last <= 0xdbff).toBe(false);
    expect(shownLength(excerpt)).toBeLessThanOrEqual(
      GLOSSARY_EXCERPT_MAX_LENGTH,
    );
  });

  it('ignores ranges outside the text', () => {
    const excerpt = cutGlossaryExcerpt('short', [{ start: 10, end: 20 }]);

    expect(excerpt.text).toBe('short');
    expect(excerpt.highlights).toEqual([]);
  });
});

describe('getGlossaryTermExcerpts', () => {
  const row = (n: number, total = 45) => ({
    uuid: `p${n}`,
    label: `1.${n}`,
    sort: n,
    type: 'translation',
    toh: null,
    instance_count: n === 1 ? 3 : 1,
    ranges: [[4, 8]],
    content: 'The TERM here.',
    total_count: total,
  });

  const clientReturning = (result: { data: unknown; error: unknown }) => {
    const rpc = jest.fn().mockResolvedValue(result);
    return { client: { rpc } as unknown as DataClient, rpc };
  };

  it('asks the source function for one page of the entry in the Toh', async () => {
    const { client, rpc } = clientReturning({ data: [row(1)], error: null });

    await getGlossaryTermExcerpts({
      client,
      uuid: 'term',
      toh: 'toh8',
      first: 20,
      after: '40',
      source: 'published',
    });

    expect(rpc).toHaveBeenCalledWith('get_glossary_term_excerpts_published', {
      p_term_uuid: 'term',
      p_toh: 'toh8',
      p_limit: 20,
      p_offset: 40,
    });
  });

  it('pages by the total the database counted', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => row(i + 1));
    const { client } = clientReturning({ data: rows, error: null });

    const page = await getGlossaryTermExcerpts({ client, uuid: 'term' });

    expect(page?.totalCount).toBe(45);
    expect(page?.items).toHaveLength(20);
    expect(page?.hasMore).toBe(true);
    expect(page?.nextCursor).toBe('20');
    expect(page?.items[0]).toMatchObject({
      uuid: 'p1',
      label: '1.1',
      instanceCount: 3,
      excerpt: { text: 'The TERM here.', highlights: [{ start: 4, end: 8 }] },
    });
  });

  it('ends on the last page', async () => {
    const { client } = clientReturning({
      data: [row(41), row(42), row(43), row(44), row(45)],
      error: null,
    });

    const page = await getGlossaryTermExcerpts({
      client,
      uuid: 'term',
      after: '40',
    });

    expect(page?.hasMore).toBe(false);
    expect(page?.nextCursor).toBeNull();
  });

  it('reports an entry with no passages as an empty page', async () => {
    const { client } = clientReturning({ data: [], error: null });

    const page = await getGlossaryTermExcerpts({ client, uuid: 'term' });

    expect(page).toEqual({
      items: [],
      totalCount: 0,
      nextCursor: null,
      hasMore: false,
    });
  });

  it('returns null when the read fails', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { client } = clientReturning({ data: null, error: { message: 'x' } });

    expect(await getGlossaryTermExcerpts({ client, uuid: 'term' })).toBeNull();
    spy.mockRestore();
  });

  it('caps the page size', async () => {
    const { client, rpc } = clientReturning({ data: [], error: null });

    await getGlossaryTermExcerpts({ client, uuid: 'term', first: 1000 });

    expect(rpc.mock.calls[0][1].p_limit).toBe(50);
  });
});
