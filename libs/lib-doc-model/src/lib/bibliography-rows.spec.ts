import { Spine } from './spine';
import { rowKindOf } from './types';

describe('bibliography rows in a spine', () => {
  const seeded = () => {
    const spine = new Spine('work-1');
    spine.seed([
      { uuid: 'h1', label: '', type: 'bibliographyHeader', sort: 1 },
      {
        uuid: 'e1',
        label: '',
        type: 'bibliography',
        sort: 2,
        parent: 'h1',
        depth: 1,
      },
      { uuid: 'p1', label: '1', type: 'translation', sort: 3 },
    ]);
    return spine;
  };

  it('places both row types in the bibliography tab', () => {
    const spine = seeded();

    expect(spine.tab('bibliography').map((entry) => entry.uuid)).toEqual([
      'h1',
      'e1',
    ]);
    expect(spine.meta('h1')).toMatchObject({
      panel: 'right',
      tab: 'bibliography',
    });
  });

  it('keeps an entry’s parent and depth', () => {
    expect(seeded().meta('e1')).toMatchObject({ parent: 'h1', depth: 1 });
  });

  it('adds neither field to a row that has none', () => {
    const meta = seeded().meta('p1');

    expect(meta).not.toHaveProperty('parent');
    expect(meta).not.toHaveProperty('depth');
  });

  it('re-derives placement when a row changes type', () => {
    const spine = seeded();
    spine.setType('p1', 'bibliography');

    expect(spine.meta('p1')).toMatchObject({
      panel: 'right',
      tab: 'bibliography',
    });
  });
});

describe('rowKindOf', () => {
  it.each([
    ['bibliographyHeader', 'heading'],
    ['bibliography', 'entry'],
    ['translationHeader', 'heading'],
    ['translation', 'entry'],
  ] as const)('%s is a %s', (type, kind) => {
    expect(rowKindOf(type)).toBe(kind);
  });
});
