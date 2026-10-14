import { assembleResolveTerms } from './read';

const g = (
  uuid: string,
  name: string,
  termType: string | null = null,
  work = 'w',
) => ({
  uuid,
  work_uuid: work,
  authority_uuid: `a-${uuid}`,
  name_uuid: `n-${uuid}`,
  termType,
});

describe('assembleResolveTerms', () => {
  it('lists self-edge terms with names, with their translation alternatives', () => {
    const glossaries = [
      g('t1', 'Blessed One'),
      g('alt', 'Lord', 'translationAlternative'),
      g('skt', 'bhagavat', 'sanskrit'),
      g('t2', 'unnamed'),
      g('other', 'Other', null, 'w2'),
    ];
    const names = new Map(
      glossaries
        .filter((x) => x.uuid !== 't2')
        .map((x) => [
          x.name_uuid,
          x.uuid === 't1' ? 'Blessed One' : x.uuid === 'alt' ? 'Lord' : x.uuid,
        ]),
    );
    const { terms, termOf } = assembleResolveTerms({
      workUuid: 'w',
      glossaries,
      edges: [
        { parent_uuid: 't1', child_uuid: 't1' },
        { parent_uuid: 't1', child_uuid: 'alt' },
        { parent_uuid: 't1', child_uuid: 'skt' },
        { parent_uuid: 't2', child_uuid: 't2' },
        { parent_uuid: 'other', child_uuid: 'other' },
      ],
      names,
    });
    expect(terms).toEqual([
      {
        uuid: 't1',
        authorityUuid: 'a-t1',
        english: 'Blessed One',
        alternatives: ['Lord'],
      },
    ]);
    expect(termOf).toEqual(
      new Map([
        ['t1', 't1'],
        ['alt', 't1'],
        ['skt', 't1'],
      ]),
    );
  });
});
