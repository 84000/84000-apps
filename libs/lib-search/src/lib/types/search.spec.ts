import { glossaryMatchFromDTO } from './search';

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
