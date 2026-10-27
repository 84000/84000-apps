import { alignmentMatchFromDTO, glossaryMatchFromDTO } from './search';

describe('glossaryMatchFromDTO', () => {
  it('uses glossary UUID as the searchable result identity', () => {
    const result = glossaryMatchFromDTO({
      authority_uuid: 'authority-uuid',
      glossary_uuid: 'glossary-uuid',
      content: 'Buddha',
      entry: {
        uuid: 'glossary-uuid',
        authority_uuid: 'authority-uuid',
        work_uuid: 'work-uuid',
        definition: 'Definition',
        names: {},
      },
    });

    expect(result.uuid).toBe('glossary-uuid');
    expect(result.entry.authority).toBe('authority-uuid');
  });
});

describe('alignmentMatchFromDTO', () => {
  it('uses the passage UUID as the result identity', () => {
    const result = alignmentMatchFromDTO({
      passage_uuid: 'passage-uuid',
      english_label: '1.10',
      english: 'English',
      tibetan: 'Tibetan',
      tibetan_volume_number: '1',
      tibetan_folio_number: '2',
    });

    expect(result.uuid).toBe('passage-uuid');
    expect(result.label).toBe('1.10');
  });
});
