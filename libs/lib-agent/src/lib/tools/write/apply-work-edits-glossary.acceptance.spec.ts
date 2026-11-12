// Acceptance tests for the glossary ops' input schema on the `apply-work-edits`
// tool: the four ops are accepted, and the fixed values are enums. No
// database. Written from the issue and its interface alone.
import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import { createWriteTools } from './index';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const WORK = '11111111-1111-4111-8111-111111111111';
const ENTRY = '22222222-2222-4222-8222-222222222222';
const AUTHORITY = '33333333-3333-4333-8333-333333333333';

const tool = () => {
  const found = createWriteTools({} as DataClient).find(
    (t) => t.name === 'apply-work-edits',
  );
  if (!found) throw new Error('no apply-work-edits tool');
  return found;
};

const parse = (op: unknown) =>
  z.object(tool().inputSchema as Any).safeParse({ workUuid: WORK, ops: [op] });

const name = (o: Record<string, unknown> = {}) => ({
  language: 'en',
  content: 'a term',
  ...o,
});

const upsert = (entry: Record<string, unknown> = {}) => ({
  op: 'upsert-glossary-entry',
  entry: {
    authority: AUTHORITY,
    names: [name()],
    ...entry,
  },
});

describe('glossary ops in the apply-work-edits input schema', () => {
  it('describes the glossary group', () => {
    expect(tool().description).toMatch(/glossary/i);
  });

  it.each([
    ['an upsert with an existing authority', upsert()],
    [
      'an upsert with a new authority',
      upsert({
        authority: {
          new: {
            headword: 'Nova',
            headwordLanguage: 'Sa-Ltn',
            definition: 'Defined.',
            uuid: AUTHORITY,
          },
        },
        definition: null,
        definitionRend: 'appendWithStandard',
        glossMode: 'marked',
        names: [
          name({ termType: 'translationMain' }),
          name({
            language: 'Bo-Ltn',
            contentTransformed: 'ཏེསྟ',
            attestation: 'reconstructedPhonetic',
            termType: 'translationAlternative',
          }),
        ],
      }),
    ],
    [
      'an upsert with expect',
      { ...upsert(), expect: { definition: null, glossMode: 'match' } },
    ],
    [
      'a patch',
      {
        op: 'patch-glossary-entry',
        uuid: ENTRY,
        set: { definition: 'New.', names: [name({ glossaryUuid: ENTRY })] },
        expect: { definition: 'Old.', names: [name()] },
      },
    ],
    [
      'a relink',
      {
        op: 'relink-glossary-entry',
        uuid: ENTRY,
        authority: AUTHORITY,
        expect: { authority: WORK },
      },
    ],
    ['a delete', { op: 'delete-glossary-entry', uuid: ENTRY }],
    [
      'a delete with expect',
      {
        op: 'delete-glossary-entry',
        uuid: ENTRY,
        expect: { definitionRend: 'prependWithStandard' },
      },
    ],
  ])('accepts %s', (_name, op) => {
    expect(parse(op).success).toBe(true);
  });

  it.each([
    'attestedApproximate',
    'attestedDictionary',
    'attestedOther',
    'attestedSource',
    'reconstructedPhonetic',
    'reconstructedSemantic',
    'sourceUnspecified',
  ])('accepts the attestation %s', (attestation) => {
    expect(parse(upsert({ names: [name({ attestation })] })).success).toBe(
      true,
    );
  });

  it.each([
    [
      'an attestation outside the fixed set',
      upsert({ names: [name({ attestation: 'bogus' })] }),
    ],
    [
      'a term type outside the fixed set',
      upsert({ names: [name({ termType: 'bogus' })] }),
    ],
    [
      'a definition rend outside the fixed set',
      upsert({ definitionRend: 'bogus' }),
    ],
    ['a gloss mode outside the fixed set', upsert({ glossMode: 'bogus' })],
    [
      'a patched gloss mode',
      {
        op: 'patch-glossary-entry',
        uuid: ENTRY,
        set: { glossMode: 'bogus' },
        expect: { glossMode: 'match' },
      },
    ],
    [
      'a patched definition rend',
      {
        op: 'patch-glossary-entry',
        uuid: ENTRY,
        set: { definitionRend: 'bogus' },
        expect: { definitionRend: null },
      },
    ],
    ['an upsert with no names key', upsert({ names: undefined })],
  ])('refuses %s', (_name, op) => {
    expect(parse(op).success).toBe(false);
  });
});
