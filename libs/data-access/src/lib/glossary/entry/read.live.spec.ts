/**
 * @jest-environment node
 */
// DEV-880 acceptance, live: criteria 1-4 (reads) and 2's write side, against
// a local Supabase. Skipped unless DEV880_LIVE=1 (see live-fixture.ts).
import {
  getGlossaryEntries,
  getGlossaryEntry,
  type DataClient,
} from '../../../index';
import {
  LIVE,
  Scratch,
  expectSuccess,
  integrity,
  liveEnv,
  makeEntry,
  nm,
  readEntry,
  saveChange,
  serviceClient,
  snapshot,
  storedEntryRows,
  uid,
  zeroChanges,
} from './live-fixture';

const describeLive = LIVE ? describe : describe.skip;

describeLive('DEV-880 live: reading entries (criteria 1-4)', () => {
  let db: DataClient;
  let s: Scratch;
  let workA: string;
  let workB: string;
  /** Holds rows the tests plant in shapes that are not clean; `integrity` skips it. */
  let dirty: Scratch;
  let workDirty: string;
  let authA: string;
  let authB: string;

  beforeAll(async () => {
    db = serviceClient(liveEnv());
    s = new Scratch(db);
    workA = await s.work();
    workB = await s.work();
    dirty = new Scratch(db);
    workDirty = await dirty.work();
    authA = await s.authority();
    authB = await s.authority();
  });

  afterAll(async () => {
    // The dirty work's rows point at the main scratch's names, so it goes first.
    await dirty?.cleanup();
    await s?.cleanup();
  });

  it('1. one entry, one object: uuid, authority, entry-wide values, names root first', async () => {
    const rootUuid = uid();
    const created = await makeEntry(db, {
      workUuid: workA,
      authorityUuid: authA,
      uuid: rootUuid,
      definition: 'A definition.',
      definitionRend: 'appendWithStandard',
      glossMode: 'marked',
      names: [
        nm.en('mind', {
          termType: 'translationMain',
          attestation: 'attestedSource',
        }),
        nm.bo('sems', 'སེམས', { attestation: 'attestedDictionary' }),
        nm.sa('citta', { termType: 'translationAlternative' }),
        nm.en('thought', { termType: 'translationAlternative' }),
      ],
    });
    const read = await getGlossaryEntry({
      client: db,
      workUuid: workA,
      uuid: rootUuid,
    });
    expect(read.status).toBe('found');
    if (read.status !== 'found') return;
    const entry = read.entry;

    expect(entry).toEqual(created);
    expect(entry.uuid).toBe(rootUuid);
    expect(entry.workUuid).toBe(workA);
    expect(entry.authorityUuid).toBe(authA);
    expect(entry.definition).toBe('A definition.');
    expect(entry.definitionRend).toBe('appendWithStandard');
    expect(entry.glossMode).toBe('marked');

    // Root name first.
    expect(entry.names).toHaveLength(4);
    expect(entry.names[0].glossaryUuid).toBe(rootUuid);
    expect(entry.names[0].content).toBe('mind');

    // Each name carries what the database holds for its row.
    const { rows } = await storedEntryRows(db, rootUuid);
    const { data: nameRows } = await db
      .from('names')
      .select('uuid,authority_uuid,language,content,content_transformed')
      .in(
        'uuid',
        rows.map((r) => r['name_uuid'] as string),
      );
    for (const n of entry.names) {
      const row = rows.find((r) => r['uuid'] === n.glossaryUuid);
      expect(row).toBeDefined();
      expect(n.nameUuid).toBe(row?.['name_uuid']);
      const name = (nameRows ?? []).find((r) => r.uuid === n.nameUuid);
      expect(name).toBeDefined();
      expect(n.nameAuthorityUuid).toBe(name?.authority_uuid);
      expect(n.language).toBe(name?.language);
      expect(n.content).toBe(name?.content);
      expect(n.contentTransformed).toBe(name?.content_transformed);
      expect(n.termType).toBe(row?.['termType']);
      expect(n.attestation).toBe(row?.['attestation']);
    }

    const tibetan = entry.names.find((n) => n.language === 'Bo-Ltn');
    expect(tibetan).toMatchObject({
      content: 'sems',
      contentTransformed: 'སེམས',
      attestation: 'attestedDictionary',
    });
    expect(entry.names.find((n) => n.content === 'citta')).toMatchObject({
      language: 'Sa-Ltn',
      termType: 'translationAlternative',
    });
    expect(entry.names[0]).toMatchObject({
      termType: 'translationMain',
      attestation: 'attestedSource',
    });
  });

  it('1. getGlossaryEntries returns the found entries in uuids order and leaves the missing out', async () => {
    const e1 = await makeEntry(db, {
      workUuid: workA,
      authorityUuid: authA,
      names: [nm.en('one')],
    });
    const e2 = await makeEntry(db, {
      workUuid: workA,
      authorityUuid: authA,
      names: [nm.en('two')],
    });
    const e3 = await makeEntry(db, {
      workUuid: workA,
      authorityUuid: authA,
      names: [nm.en('three')],
    });
    const found = await getGlossaryEntries({
      client: db,
      workUuid: workA,
      uuids: [e3.uuid, uid(), e1.uuid, e2.uuid],
    });
    expect(found?.map((e) => e.uuid)).toEqual([e3.uuid, e1.uuid, e2.uuid]);
    expect(
      await getGlossaryEntries({ client: db, workUuid: workA, uuids: [] }),
    ).toEqual([]);
  });

  it('2. entry-wide values are read from the root row', async () => {
    const e = await makeEntry(db, {
      workUuid: workDirty,
      authorityUuid: authA,
      definition: 'Root definition.',
      definitionRend: 'prependWithStandard',
      glossMode: 'marked',
      names: [nm.en('root'), nm.en('child')],
    });
    // A child row that (wrongly) carries values of its own must not be read.
    const childUuid = e.names[1].glossaryUuid;
    const { error } = await db
      .from('glossaries')
      .update({
        definition: 'Child definition.',
        definition_rend: 'overrideWithStandard',
        glossMode: 'match',
      })
      .eq('uuid', childUuid);
    expect(error).toBeNull();
    const read = await readEntry(db, workDirty, e.uuid);
    expect(read.definition).toBe('Root definition.');
    expect(read.definitionRend).toBe('prependWithStandard');
    expect(read.glossMode).toBe('marked');
  });

  it('2. a save writes entry-wide values on the root only, and new child rows carry none', async () => {
    const e = await makeEntry(db, {
      workUuid: workA,
      authorityUuid: authA,
      names: [nm.en('root-x'), nm.en('child-x')],
    });
    const before = await readEntry(db, workA, e.uuid);
    const result = expectSuccess(
      await saveChange(db, workA, before, {
        definition: 'Now defined.',
        definitionRend: 'overrideWithStandard',
        glossMode: 'marked',
        names: [...before.names, nm.en('added-child')],
      }),
    );
    expect(result.entries[0]).toMatchObject({
      definition: 'Now defined.',
      definitionRend: 'overrideWithStandard',
      glossMode: 'marked',
    });
    const { rows } = await storedEntryRows(db, e.uuid);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      if (row['uuid'] === e.uuid) {
        expect(row['definition']).toBe('Now defined.');
        expect(row['definition_rend']).toBe('overrideWithStandard');
        expect(row['glossMode']).toBe('marked');
      } else {
        expect(row['definition']).toBeNull();
        expect(row['definition_rend']).toBeNull();
        expect(row['glossMode']).toBeNull();
      }
    }
    expect(await integrity(s)).toEqual([]);
  });

  it('3. an unset matching mode reads as match, and match over null is no change', async () => {
    const e = await makeEntry(db, {
      workUuid: workA,
      authorityUuid: authA,
      names: [nm.en('unset-mode')],
    });
    const { rows } = await storedEntryRows(db, e.uuid);
    expect(rows[0]['glossMode']).toBeNull();
    const read = await readEntry(db, workA, e.uuid);
    expect(read.glossMode).toBe('match');

    const before = await snapshot(s);
    const result = expectSuccess(
      await saveChange(db, workA, read, { glossMode: 'match' }),
    );
    expect(result.changes).toEqual(zeroChanges);
    expect(await snapshot(s)).toEqual(before);
  });

  it('3. creating with match reads as match; marked and back to unset reads as match again', async () => {
    const e = await makeEntry(db, {
      workUuid: workA,
      authorityUuid: authA,
      glossMode: 'match',
      names: [nm.en('explicit-match')],
    });
    expect(e.glossMode).toBe('match');
    const marked = expectSuccess(
      await saveChange(db, workA, e, { glossMode: 'marked' }),
    );
    expect(marked.entries[0].glossMode).toBe('marked');
    const unset = expectSuccess(
      await saveChange(db, workA, marked.entries[0], { glossMode: null }),
    );
    expect(unset.entries[0].glossMode).toBe('match');
    const { rows } = await storedEntryRows(db, e.uuid);
    expect(rows[0]['glossMode'] ?? 'match').toBe('match');
  });

  it('4. a uuid that is not an entry reads as not-found, not an error', async () => {
    const e = await makeEntry(db, {
      workUuid: workA,
      authorityUuid: authA,
      names: [nm.en('real'), nm.en('real child')],
    });
    // No such row at all.
    expect(
      await getGlossaryEntry({ client: db, workUuid: workA, uuid: uid() }),
    ).toEqual({
      status: 'not-found',
    });
    // An entry of another work.
    expect(
      await getGlossaryEntry({ client: db, workUuid: workB, uuid: e.uuid }),
    ).toEqual({
      status: 'not-found',
    });
    // A child row of an entry is not itself an entry.
    expect(
      await getGlossaryEntry({
        client: db,
        workUuid: workA,
        uuid: e.names[1].glossaryUuid,
      }),
    ).toEqual({ status: 'not-found' });
    // A `glossaries` row with no edges is not an entry.
    const nameUuid = await s.name({
      authorityUuid: authB,
      language: 'en',
      content: 'orphan',
    });
    const orphan = uid();
    const { error } = await db.from('glossaries').insert({
      uuid: orphan,
      work_uuid: workDirty,
      authority_uuid: authB,
      name_uuid: nameUuid,
    });
    expect(error).toBeNull();
    expect(
      await getGlossaryEntry({ client: db, workUuid: workDirty, uuid: orphan }),
    ).toEqual({
      status: 'not-found',
    });
    // The list read leaves them out and is not null.
    expect(
      await getGlossaryEntries({
        client: db,
        workUuid: workDirty,
        uuids: [orphan, uid(), e.names[1].glossaryUuid],
      }),
    ).toEqual([]);
  });
});
