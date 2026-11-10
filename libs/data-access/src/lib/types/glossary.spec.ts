import {
  glossaryTermInstanceFromDTO,
  type GlossaryTermInstanceDTO,
} from './glossary';

describe('glossaryTermInstanceFromDTO', () => {
  const ENTRY = 'a1a1a1a1-0000-4000-8000-000000000001';
  const AUTHORITY_A = 'b2b2b2b2-0000-4000-8000-00000000000a';
  const AUTHORITY_B = 'c3c3c3c3-0000-4000-8000-00000000000b';

  const row = (authority_uuid: string): GlossaryTermInstanceDTO =>
    ({
      uuid: ENTRY,
      authority_uuid,
      work_uuid: 'w-1',
      names: { english: 'term' },
    }) as GlossaryTermInstanceDTO;

  it("reads the entry's current authority from its stored row", () => {
    expect(glossaryTermInstanceFromDTO(row(AUTHORITY_A)).authority).toBe(
      AUTHORITY_A,
    );
    expect(glossaryTermInstanceFromDTO(row(AUTHORITY_B)).authority).toBe(
      AUTHORITY_B,
    );
  });
});
