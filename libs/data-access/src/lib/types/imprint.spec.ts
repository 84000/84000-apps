import { TocEntryDTO, tocFromDTO } from './imprint';

const row = (overrides: Partial<TocEntryDTO>): TocEntryDTO => ({
  uuid: 'uuid',
  content: 'Heading',
  sort: 1,
  section: 'translation',
  level: 1,
  ...overrides,
});

describe('tocFromDTO', () => {
  it('lists a passage with several headings once, keeping its first row', () => {
    const toc = tocFromDTO([
      row({ uuid: 'a', sort: 1, level: 1, content: 'Part One' }),
      row({ uuid: 'b', sort: 2, level: 3, content: 'First' }),
      row({ uuid: 'b', sort: 2, level: 5, content: 'Second' }),
      row({ uuid: 'c', sort: 3, level: 1, content: 'Part Two' }),
    ]);

    expect(toc.body.map(({ uuid }) => uuid)).toEqual(['a', 'c']);
    expect(toc.body[0].children).toHaveLength(1);
    expect(toc.body[0].children[0]).toMatchObject({
      uuid: 'b',
      level: 3,
      content: 'First',
    });
  });

  it('dedupes back-matter headings too', () => {
    const toc = tocFromDTO([
      row({ uuid: 'abbr', section: 'abbreviations', level: 3 }),
      row({ uuid: 'abbr', section: 'abbreviations', level: 5 }),
      row({ uuid: 'intro', section: 'introduction' }),
    ]);

    expect(toc.backMatter.map(({ uuid }) => uuid)).toEqual(['abbr']);
    expect(toc.frontMatter.map(({ uuid }) => uuid)).toEqual(['intro']);
    expect(toc.body).toEqual([]);
  });
});
