import { derivedUuid } from '../passage/derived-uuids';
import type {
  GlossaryExpect,
  GlossaryOp,
  UpsertGlossaryEntryOp,
} from './types';

/** Uuids of glossary ops: lowercased, and derived for an upsert without one. */

const lower = <T extends string | undefined>(uuid: T): T =>
  (uuid?.toLowerCase() ?? uuid) as T;

const lowerNames = <N extends { glossaryUuid?: string }>(names: readonly N[]) =>
  names.map((name) => ({ ...name, glossaryUuid: lower(name.glossaryUuid) }));

const lowerExpect = (expect: GlossaryExpect | undefined) =>
  expect && { ...expect, authority: lower(expect.authority) };

/**
 * The op with its uuids in lowercase, the form they are stored and derived
 * in; a uuid given in uppercase names the same row.
 */
export const lowerUuids = (op: GlossaryOp): GlossaryOp => {
  switch (op.op) {
    case 'upsert-glossary-entry': {
      const { authority } = op.entry;
      return {
        ...op,
        entry: {
          ...op.entry,
          uuid: lower(op.entry.uuid),
          authority:
            typeof authority === 'string'
              ? lower(authority)
              : { new: { ...authority.new, uuid: lower(authority.new.uuid) } },
          names: lowerNames(op.entry.names),
        },
        expect: lowerExpect(op.expect),
      };
    }
    case 'patch-glossary-entry':
      return {
        ...op,
        uuid: lower(op.uuid),
        set: {
          ...op.set,
          ...(op.set.names ? { names: lowerNames(op.set.names) } : {}),
        },
        expect: lowerExpect(op.expect) as GlossaryExpect,
      };
    case 'relink-glossary-entry':
      return {
        ...op,
        uuid: lower(op.uuid),
        authority: lower(op.authority),
        expect: op.expect && { authority: lower(op.expect.authority) },
      };
    case 'delete-glossary-entry':
      return { ...op, uuid: lower(op.uuid), expect: lowerExpect(op.expect) };
  }
};

/** The uuid an upserted entry gets when it arrives without one. */
const upsertEntryUuid = (workUuid: string, op: UpsertGlossaryEntryOp) => {
  const { entry } = op;
  if (entry.uuid) return entry.uuid;
  const { authority } = entry;
  const authorityKey =
    typeof authority === 'string'
      ? authority
      : (authority.new.uuid ??
        `new:${authority.new.headwordLanguage}:${authority.new.headword}`);
  const root = entry.names[0];
  return derivedUuid(
    'glossary-entry',
    workUuid,
    authorityKey,
    root?.language ?? '',
    root?.content ?? '',
  );
};

/** The entry uuid an op names. */
export const entryUuidOf = (workUuid: string, op: GlossaryOp) =>
  op.op === 'upsert-glossary-entry' ? upsertEntryUuid(workUuid, op) : op.uuid;
