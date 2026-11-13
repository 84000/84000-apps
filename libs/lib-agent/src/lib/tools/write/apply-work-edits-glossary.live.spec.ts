/**
 * @jest-environment node
 */
// The glossary ops at the MCP tool boundary, against a local Supabase: the
// `apply-work-edits` tool from `createWriteTools`, and `get-glossary-term`
// reading what it wrote.
//
// Skipped unless DATA_ACCESS_LIVE=1. Needs SUPABASE_URL (local),
// SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY and SUPABASE_JWT_SECRET.
import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { createGetGlossaryTermTool } from '../read/get-glossary-term';
import { createWriteTools } from './index';
import {
  Scratch,
  describeLive,
  select,
  serviceClient,
  signedInClient,
  uid,
} from '@eightyfourthousand/data-access/live-fixture';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const ENTITY_ID = /^entity-\d+$/;

describeLive('glossary ops in the apply-work-edits tool, live', () => {
  let c: { db: DataClient; editor: DataClient };
  let s: Scratch;
  let workUuid: string;

  beforeAll(async () => {
    c = { db: serviceClient(), editor: signedInClient('editor') };
    s = new Scratch(c.db);
    workUuid = await s.work();
  });

  afterAll(async () => {
    await s?.cleanup();
    if (s) {
      expect(await s.leftovers()).toEqual({
        works: 0,
        passages: 0,
        creators: 0,
        authorities: 0,
        names: 0,
        glossaries: 0,
      });
    }
  });

  const toolOf = (client: DataClient, name = 'apply-work-edits') => {
    const tool = [
      ...createWriteTools(client),
      createGetGlossaryTermTool(client),
    ].find((t) => t.name === name) as McpToolDefinition;
    if (!tool) throw new Error(`no tool named ${name}`);
    return tool;
  };

  /** Calls a tool as the MCP server does: input parsed by the tool's schema. */
  const call = async (
    client: DataClient,
    name: string,
    args: Record<string, unknown>,
  ) => {
    const tool = toolOf(client, name);
    const input = z.object(tool.inputSchema as Any).parse(args);
    const result: Any = await tool.handler(input as never, {} as never);
    const text = result.content[0].text as string;
    let body: Any;
    try {
      body = JSON.parse(text);
    } catch {
      body = undefined;
    }
    return { isError: result.isError === true, text, body };
  };

  const edit = (client: DataClient, ops: unknown[], dryRun?: boolean) =>
    call(client, 'apply-work-edits', { workUuid, ops, dryRun });

  const glossary = (body: Any) =>
    body.groups.find((g: Any) => g.group === 'glossary');

  const authorityRows = (uuids: string[]) =>
    select(c.db, 'authorities', 'uuid', uuids);

  const newEntry = (what: string) => {
    const authorityUuid = s.track(uid());
    const entryUuid = uid();
    return {
      authorityUuid,
      entryUuid,
      headword: s.label(`${what} headword`),
      op: {
        op: 'upsert-glossary-entry',
        entry: {
          uuid: entryUuid,
          authority: {
            new: {
              uuid: authorityUuid,
              headword: s.label(`${what} headword`),
              headwordLanguage: 'Sa-Ltn',
              definition: 'The new standard definition.',
            },
          },
          definition: 'The entry definition.',
          definitionRend: 'incompatibleWithStandard',
          names: [
            {
              language: 'en',
              content: s.label(`${what} root`),
              termType: 'translationMain',
            },
            {
              language: 'Bo-Ltn',
              content: s.label(`${what} wylie`),
              contentTransformed: 'ཏེསྟ',
              termType: 'translationMain',
              attestation: 'attestedSource',
            },
            {
              language: 'en',
              content: s.label(`${what} alternative`),
              termType: 'translationAlternative',
            },
          ],
        },
      },
    };
  };

  it('creates an entry with names and a new authority, dry-runs, applies, and reads it back with get-glossary-term', async () => {
    const n = newEntry('create');
    const before = await s.snapshot();

    const dry = await edit(c.editor, [n.op], true);
    expect(dry.isError).toBe(false);
    expect(dry.body).toMatchObject({ success: true, dryRun: true });
    expect(glossary(dry.body).applied).toBe(false);
    expect(glossary(dry.body).changes.authorities).toEqual([
      {
        uuid: n.authorityUuid,
        headword: n.headword,
        headwordLanguage: 'Sa-Ltn',
        definition: 'The new standard definition.',
        xmlId: null,
      },
    ]);
    expect(glossary(dry.body).changes.entries[0]).toMatchObject({
      uuid: n.entryUuid,
      action: 'create',
      before: null,
    });
    expect(await s.snapshot()).toEqual(before);
    expect(await authorityRows([n.authorityUuid])).toEqual([]);
    const missing = await call(c.editor, 'get-glossary-term', {
      uuid: n.entryUuid,
      source: 'draft',
    });
    expect(missing.isError).toBe(true);

    const applied = await edit(c.editor, [n.op]);
    expect(applied.isError).toBe(false);
    expect(applied.body).toMatchObject({ success: true, dryRun: false });
    expect(glossary(applied.body).applied).toBe(true);
    const [created] = glossary(applied.body).changes.authorities;
    expect(created.uuid).toBe(n.authorityUuid);
    expect(created.xmlId).toMatch(ENTITY_ID);
    const [authority] = await authorityRows([n.authorityUuid]);
    expect(authority).toMatchObject({
      xmlId: created.xmlId,
      headword: n.headword,
    });

    // Straight back, as the draft term.
    const term = await call(c.editor, 'get-glossary-term', {
      uuid: n.entryUuid,
      source: 'draft',
    });
    expect(term.isError).toBe(false);
    expect(term.body).toMatchObject({
      uuid: n.entryUuid,
      authority: n.authorityUuid,
      workUuid,
      definition: 'The entry definition.',
      names: {
        english: s.label('create root'),
        wylie: s.label('create wylie'),
        alternatives: s.label('create alternative'),
      },
    });
  });

  it('refuses a patch-glossary-entry with a stale expect, writing nothing, and applies it with the stored one', async () => {
    const authority = await s.authority();
    const nameUuid = await s.name({
      authorityUuid: authority,
      language: 'en',
      content: s.label('stale root'),
    });
    const entry = await s.row({
      workUuid,
      authorityUuid: authority,
      nameUuid,
      termType: 'translationMain',
      definition: 'Original.',
    });
    const before = await s.snapshot();

    for (const dryRun of [true, false]) {
      const res = await edit(
        c.editor,
        [
          {
            op: 'patch-glossary-entry',
            uuid: entry,
            set: { definition: 'Replacement.' },
            expect: { definition: 'A stale definition.' },
          },
        ],
        dryRun,
      );
      // The JSON is still the body, so the caller sees the group's state.
      expect(res.isError).toBe(true);
      expect(res.body.success).toBe(false);
      expect(glossary(res.body).applied).toBe(false);
      expect(glossary(res.body).error).toContain('A stale definition.');
      expect(glossary(res.body).error).toContain('Original.');
      expect(await s.snapshot()).toEqual(before);
    }

    const ok = await edit(c.editor, [
      {
        op: 'patch-glossary-entry',
        uuid: entry,
        set: { definition: 'Replacement.' },
        expect: { definition: 'Original.' },
      },
    ]);
    expect(ok.isError).toBe(false);
    const term = await call(c.editor, 'get-glossary-term', {
      uuid: entry,
      source: 'draft',
    });
    expect(term.body).toMatchObject({ definition: 'Replacement.' });
  });
});
