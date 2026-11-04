import { DataClient } from '../types';

/**
 * Write a glossary entry's own definition, with how it combines with the standard.
 *
 * Built for publication QA: an entry set to `overrideWithStandard` whose authority
 * has no standard definition shows nothing, so the fix is to give the entry a
 * definition of its own and stop deferring to the missing standard. The house
 * convention for that is `incompatibleWithStandard`, the default here: the
 * entry's own definition is shown and the standard is ignored. The other
 * `*WithStandard` rends combine with the standard, and SQL concatenation with a
 * null standard is null, so they too show nothing while the standard is missing.
 *
 * Guarded against writing over a change the caller has not seen: the entry must
 * belong to the given work and still hold `expectedDefinition`. A dry run reads,
 * checks and returns the change without writing.
 */

export const DEFINITION_RENDS = [
  'incompatibleWithStandard',
  'overrideWithStandard',
  'appendWithStandard',
  'prependWithStandard',
  'bothWithStandard',
] as const;

export type DefinitionRend = (typeof DEFINITION_RENDS)[number];

/** The rend an entry takes once it has a definition of its own. */
export const OWN_DEFINITION_REND: DefinitionRend = 'incompatibleWithStandard';

export type GlossaryDefinitionState = {
  definition: string | null;
  definitionRend: string | null;
};

export type UpdateGlossaryDefinitionResult =
  | {
      ok: true;
      dryRun: boolean;
      glossaryUuid: string;
      before: GlossaryDefinitionState;
      after: GlossaryDefinitionState;
    }
  | { ok: false; error: string; current?: GlossaryDefinitionState };

type Row = {
  uuid: string;
  work_uuid: string;
  definition: string | null;
  definition_rend: string | null;
};

const state = (row: Row): GlossaryDefinitionState => ({
  definition: row.definition,
  definitionRend: row.definition_rend,
});

export const updateGlossaryDefinition = async ({
  client,
  workUuid,
  glossaryUuid,
  definition,
  definitionRend = OWN_DEFINITION_REND,
  expectedDefinition,
  dryRun = false,
}: {
  client: DataClient;
  workUuid: string;
  glossaryUuid: string;
  definition: string;
  /** Defaults to `incompatibleWithStandard`: the entry's own definition only. */
  definitionRend?: DefinitionRend;
  /** The entry's definition as the caller last read it. */
  expectedDefinition: string | null;
  dryRun?: boolean;
}): Promise<UpdateGlossaryDefinitionResult> => {
  if (!definition.trim()) {
    return { ok: false, error: 'The new definition is empty.' };
  }

  const { data, error } = await client
    .from('glossaries')
    .select('uuid, work_uuid, definition, definition_rend')
    .eq('uuid', glossaryUuid)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: `Failed to read glossary entry ${glossaryUuid}: ${error.message}`,
    };
  }
  const row = data as Row | null;
  if (!row) {
    return { ok: false, error: `No glossary entry ${glossaryUuid}.` };
  }
  if (row.work_uuid !== workUuid) {
    return {
      ok: false,
      error: `Glossary entry ${glossaryUuid} belongs to work ${row.work_uuid}, not ${workUuid}.`,
    };
  }
  if (row.definition !== expectedDefinition) {
    return {
      ok: false,
      error:
        'The entry’s definition has changed since it was read. Re-read it and confirm the change with the editor again.',
      current: state(row),
    };
  }

  const after: GlossaryDefinitionState = { definition, definitionRend };
  if (dryRun) {
    return { ok: true, dryRun: true, glossaryUuid, before: state(row), after };
  }

  let update = client
    .from('glossaries')
    .update({ definition, definition_rend: definitionRend })
    .eq('uuid', glossaryUuid)
    .eq('work_uuid', workUuid);
  // Compare-and-set, so a write between the read above and this one is not lost.
  update =
    expectedDefinition === null
      ? update.is('definition', null)
      : update.eq('definition', expectedDefinition);

  const { data: written, error: writeError } = await update.select(
    'uuid, work_uuid, definition, definition_rend',
  );

  if (writeError) {
    return {
      ok: false,
      error: `Failed to update glossary entry ${glossaryUuid}: ${writeError.message}`,
    };
  }
  const rows = (written ?? []) as Row[];
  if (rows.length !== 1) {
    return {
      ok: false,
      error:
        'No row was updated: the entry changed during the write, or you lack permission to edit it. Re-read it before trying again.',
    };
  }

  return {
    ok: true,
    dryRun: false,
    glossaryUuid,
    before: state(row),
    after: state(rows[0]),
  };
};
