/**
 * @jest-environment node
 */
// Copying a glossary entry between works against a local Supabase, as the
// seeded editor. Skipped unless DATA_ACCESS_LIVE=1, with SUPABASE_URL (a local
// URL), SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY and SUPABASE_JWT_SECRET.
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

import type { DataClient } from '../../types';
import {
  copyGlossaryEntry,
  getGlossaryEntriesOfAuthority,
  searchGlossaryEntriesToCopy,
} from './copy';
import { getGlossaryEntry } from './read';
import { createGlossaryEntry, saveGlossaryEntry } from './save';
import type { GlossaryEntry, GlossarySaveResult } from './types';

const LIVE = process.env['DATA_ACCESS_LIVE'] === '1';
const describeLive = LIVE ? describe : describe.skip;

type Row = Record<string, unknown>;

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false },
};

const localUrl = (): string => {
  const url = process.env['SUPABASE_URL'] ?? '';
  const host = URL.canParse(url) ? new URL(url).hostname : '';
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error('SUPABASE_URL must be a local Supabase (127.0.0.1)');
  }
  return url;
};

/** The service-role client, for fixtures and checks. */
const serviceClient = (): DataClient => {
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient(localUrl(), key, clientOptions);
};

const b64 = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

/** A client signed in as the local seed's editor, who has editor.edit. */
const editorClient = (): DataClient => {
  const key = process.env['SUPABASE_ANON_KEY'];
  const secret = process.env['SUPABASE_JWT_SECRET'];
  if (!key) throw new Error('SUPABASE_ANON_KEY is not set');
  if (!secret) throw new Error('SUPABASE_JWT_SECRET is not set');
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({
    sub: '33333333-3333-3333-3333-333333333333',
    role: 'authenticated',
    aud: 'authenticated',
    user_role: 'editor',
    iat: now,
    exp: now + 3600,
  });
  const sig = createHmac('sha256', secret)
    .update(`${head}.${body}`)
    .digest('base64url');
  return createClient(localUrl(), key, {
    ...clientOptions,
    global: { headers: { Authorization: `Bearer ${head}.${body}.${sig}` } },
  });
};

const check = (error: { message: string } | null, what: string) => {
  if (error) throw new Error(`${what}: ${error.message}`);
};

const entryOf = (result: GlossarySaveResult): GlossaryEntry => {
  if (!result.success) throw new Error(`save refused: ${result.error}`);
  return result.entries[0];
};

describeLive('copying a glossary entry between works (live)', () => {
  const db = LIVE ? serviceClient() : (null as unknown as DataClient);
  const editor = LIVE ? editorClient() : (null as unknown as DataClient);
  const tag = uuidv4().replace(/-/g, '').slice(0, 10);
  const word = `copyspec${tag}`;
  const works: string[] = [];
  const authorities: string[] = [];

  const work = async () => {
    const uuid = uuidv4();
    check(
      (await db.from('works').insert({ uuid, title: `copy spec ${tag}` }))
        .error,
      'insert work',
    );
    works.push(uuid);
    return uuid;
  };

  const authority = async () => {
    const uuid = uuidv4();
    check(
      (
        await db.from('authorities').insert({
          uuid,
          xmlId: `copy-spec-${tag}-${authorities.length}`,
          headword: `Headword ${word}`,
        })
      ).error,
      'insert authority',
    );
    authorities.push(uuid);
    return uuid;
  };

  const rowsOf = async (workUuid: string) => {
    const { data, error } = await db
      .from('glossaries')
      .select('*')
      .eq('work_uuid', workUuid)
      .order('uuid');
    check(error, 'select glossaries');
    return (data ?? []) as Row[];
  };

  let source: GlossaryEntry;
  let target: string;

  beforeAll(async () => {
    const from = await work();
    target = await work();
    const authorityUuid = await authority();
    source = entryOf(
      await createGlossaryEntry({
        client: editor,
        workUuid: from,
        entry: {
          authorityUuid,
          definition: '<p>The source definition.</p>',
          definitionRend: 'appendWithStandard',
          glossMode: 'marked',
          names: [
            {
              language: 'en',
              content: `Lotus ${word}`,
              contentTransformed: null,
              termType: 'translationMain',
              attestation: null,
            },
            {
              language: 'Bo-Ltn',
              content: 'pad+ma',
              contentTransformed: 'པདྨ',
              termType: null,
              attestation: 'attestedSource',
            },
            {
              language: 'Sa-Ltn',
              content: 'padma',
              contentTransformed: null,
              termType: null,
              attestation: 'attestedDictionary',
            },
          ],
        },
      }),
    );
  });

  afterAll(async () => {
    if (!LIVE) return;
    for (const [what, run] of [
      [
        'glossaries',
        () => db.from('glossaries').delete().in('work_uuid', works),
      ],
      [
        'names',
        () => db.from('names').delete().in('authority_uuid', authorities),
      ],
      [
        'authorities',
        () => db.from('authorities').delete().in('uuid', authorities),
      ],
      ['works', () => db.from('works').delete().in('uuid', works)],
    ] as const) {
      const { error } = await run();
      if (error) console.warn(`cleanup (${what}): ${error.message}`);
    }
  });

  it('finds the entry from another work, with its work and headword', async () => {
    const found = await searchGlossaryEntriesToCopy({
      client: editor,
      workUuid: target,
      query: word,
    });
    expect(found).toEqual([
      expect.objectContaining({
        entry: source,
        label: 'g.1',
        work: expect.objectContaining({ uuid: source.workUuid }),
        headword: `Headword ${word}`,
      }),
    ]);
  });

  it('leaves out entries of the work being copied into', async () => {
    const found = await searchGlossaryEntriesToCopy({
      client: editor,
      workUuid: source.workUuid,
      query: word,
    });
    expect(found?.some((s) => s.entry.workUuid === source.workUuid)).toBe(
      false,
    );
  });

  it('copies with the same names rows and settings, leaving the source as it was', async () => {
    const before = await rowsOf(source.workUuid);
    expect(
      await getGlossaryEntriesOfAuthority({
        client: editor,
        workUuid: target,
        authorityUuid: source.authorityUuid,
      }),
    ).toEqual([]);

    const copy = entryOf(
      await copyGlossaryEntry({ client: editor, workUuid: target, source }),
    );

    expect(copy.uuid).not.toBe(source.uuid);
    expect(copy).toMatchObject({
      workUuid: target,
      authorityUuid: source.authorityUuid,
      definition: source.definition,
      definitionRend: 'appendWithStandard',
      glossMode: 'marked',
    });
    const names = (entry: GlossaryEntry) =>
      entry.names
        .map(({ nameUuid, termType, attestation }) => ({
          nameUuid,
          termType,
          attestation,
        }))
        .sort((a, b) => a.nameUuid.localeCompare(b.nameUuid));
    expect(names(copy)).toEqual(names(source));
    expect(await rowsOf(source.workUuid)).toEqual(before);
    expect(
      await getGlossaryEntriesOfAuthority({
        client: editor,
        workUuid: target,
        authorityUuid: source.authorityUuid,
      }),
    ).toEqual([copy]);

    // Editing the copy later leaves the source as it was.
    entryOf(
      await saveGlossaryEntry({
        client: editor,
        workUuid: target,
        before: copy,
        after: {
          definition: '<p>The copy, edited.</p>',
          names: copy.names.map((name) =>
            name.language === 'en'
              ? { ...name, content: `Edited lotus ${word}` }
              : name,
          ),
        },
      }),
    );
    const read = await getGlossaryEntry({
      client: db,
      workUuid: source.workUuid,
      uuid: source.uuid,
    });
    expect(read).toEqual({ status: 'found', entry: source });
  });
});
