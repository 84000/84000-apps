import type { APIRequestContext, Request } from '@playwright/test';
import {
  type AnnotationDTO,
  passageFromDTO,
  type PassageDTO,
  savePassagesWithDeletions,
} from '@eightyfourthousand/data-access';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { db } from './db';
import { GRAPHQL_PORT, localStack, TEST_USER_EMAIL } from './local-stack';

/**
 * Glossary-entry passages: what the dialog and the
 * `glossaryTermExcerpts` query should return, worked out from the local
 * database, and how to ask the API for it.
 */

export const GRAPHQL_URL = `http://localhost:${GRAPHQL_PORT}/api/graphql`;

/** Toh 8, the local work with the most glossary instances. */
export const TOH8_WORK = 'a66be036-4471-4991-bbb3-29d66f67b70d';
/** The entry with the most passages, in Toh 8 locally and in production. */
export const HEAVIEST_TERM = 'ccc27a45-158f-4dd7-810e-cdc6413fbed8';

/** Entries of the test work, by their English name. */
export const TERMS = {
  greatCompassion: '8c143eaa-317c-4947-8bf2-a4e887e8f534',
  bodhisattva: 'bc10eef7-7805-4050-849c-371dafae0a06',
  dharma: 'cb278137-b004-43dd-8eb9-50722623228e',
} as const;

/** The page size the dialog loads. */
export const PAGE_SIZE = 20;

/** The longest excerpt, not counting ellipses. */
export const MAX_EXCERPT = 300;

export type Excerpt = {
  uuid: string;
  label: string;
  type: string;
  sort: number;
  toh: string | null;
  instanceCount: number;
  text: string;
  truncatedStart: boolean;
  truncatedEnd: boolean;
  highlights: { start: number; end: number }[];
};

export type ExcerptsPage = {
  items: Excerpt[];
  totalCount: number;
  nextCursor: string | null;
  hasMore: boolean;
};

const EXCERPTS_QUERY = `
  query Excerpts($uuid: ID!, $toh: String, $first: Int, $after: String) {
    glossaryTermExcerpts(uuid: $uuid, toh: $toh, first: $first, after: $after) {
      items {
        uuid
        label
        type
        sort
        toh
        instanceCount
        text
        truncatedStart
        truncatedEnd
        highlights { start end }
      }
      totalCount
      nextCursor
      hasMore
    }
  }
`;

let token: string | undefined;

/** An access token for the suite's editor account, minted like auth.setup. */
export const accessToken = async (): Promise<string> => {
  if (token) return token;
  const { apiUrl, anonKey } = localStack();
  const { data: link, error } = await db().auth.admin.generateLink({
    type: 'magiclink',
    email: TEST_USER_EMAIL,
  });
  if (error || !link.properties) {
    throw new Error(`generateLink failed: ${error?.message}`);
  }
  const anon = createClient(apiUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error: otpError } = await anon.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'magiclink',
  });
  if (otpError || !data.session) {
    throw new Error(`verifyOtp failed: ${otpError?.message}`);
  }
  token = data.session.access_token;
  return token;
};

/**
 * One page of excerpts. `draft` asks as the editor does (signed in, draft
 * source); `published` asks as the public reader does (no session, published
 * source).
 */
export const excerptsPage = async (
  request: APIRequestContext,
  {
    uuid,
    toh,
    first = PAGE_SIZE,
    after,
    source = 'draft',
  }: {
    uuid: string;
    toh?: string;
    first?: number;
    after?: string | null;
    source?: 'draft' | 'published';
  },
): Promise<ExcerptsPage | null> => {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-84000-content-source': source,
  };
  if (source === 'draft') {
    headers['authorization'] = `Bearer ${await accessToken()}`;
  }
  const response = await request.post(GRAPHQL_URL, {
    headers,
    data: {
      query: EXCERPTS_QUERY,
      variables: { uuid, toh, first, after: after ?? undefined },
    },
    timeout: 60_000,
  });
  const body = await response.json();
  if (body.errors?.length) {
    throw new Error(`glossaryTermExcerpts: ${JSON.stringify(body.errors)}`);
  }
  return body.data.glossaryTermExcerpts;
};

/** Every excerpt, following `nextCursor` until `hasMore` is false. */
export const allExcerpts = async (
  request: APIRequestContext,
  args: { uuid: string; toh?: string; source?: 'draft' | 'published' },
): Promise<{ pages: ExcerptsPage[]; items: Excerpt[] }> => {
  const pages: ExcerptsPage[] = [];
  let after: string | null = null;
  for (let i = 0; i < 1000; i++) {
    const page: ExcerptsPage | null = await excerptsPage(request, {
      ...args,
      after,
    });
    if (!page) throw new Error(`page ${i + 1} came back null`);
    pages.push(page);
    if (!page.hasMore) break;
    if (!page.nextCursor) throw new Error('hasMore without a nextCursor');
    after = page.nextCursor;
  }
  return { pages, items: pages.flatMap((p) => p.items) };
};

export type ExpectedPassage = {
  uuid: string;
  label: string;
  type: string;
  sort: number;
  toh: string | null;
  content: string;
  /** The entry's instances in this passage, by start. */
  instances: { start: number; end: number }[];
};

const fail = (what: string, error: { message: string } | null) => {
  if (error) throw new Error(`${what}: ${error.message}`);
};

/**
 * The glossary rows that count as the entry: its root row only. An instance
 * that cites one of its child rows is not the entry's.
 */
export const entryRows = async (termUuid: string): Promise<string[]> => [
  termUuid,
];

type InstanceRow = {
  uuid: string;
  passage_uuid: string;
  start: number;
  end: number;
  toh: string | null;
  passages: {
    uuid: string;
    label: string;
    type: string;
    sort: number;
    toh: string | null;
    content: string;
  };
};

/**
 * The passages of a work that use the entry in a Toh, in passage order, from
 * the draft tables: an instance counts when it and its passage are either
 * shared by every Toh or belong to this one.
 */
export const expectedPassages = async ({
  workUuid,
  termUuid,
  toh,
}: {
  workUuid: string;
  termUuid: string;
  toh: string;
}): Promise<ExpectedPassage[]> => {
  const instances = new Map<string, InstanceRow>();
  for (const row of await entryRows(termUuid)) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db()
        .from('passage_annotations')
        .select(
          'uuid, passage_uuid, start, end, toh, passages!inner(uuid, label, type, sort, toh, content, work_uuid)',
        )
        .eq('type', 'glossary-instance')
        .eq('passages.work_uuid', workUuid)
        .contains('content', JSON.stringify([{ uuid: row }]))
        .order('uuid')
        .range(from, from + 999);
      fail('read glossary instances', error);
      for (const a of (data ?? []) as unknown as InstanceRow[]) {
        instances.set(a.uuid, a);
      }
      if ((data ?? []).length < 1000) break;
    }
  }
  const byPassage = new Map<string, ExpectedPassage>();
  for (const a of instances.values()) {
    const p = a.passages;
    if (a.toh && a.toh !== toh) continue;
    if (p.toh && p.toh !== toh) continue;
    const entry = byPassage.get(p.uuid) ?? {
      uuid: p.uuid,
      label: p.label,
      type: p.type,
      sort: p.sort,
      toh: p.toh,
      content: p.content,
      instances: [],
    };
    entry.instances.push({ start: a.start, end: a.end });
    byPassage.set(p.uuid, entry);
  }
  const out = [...byPassage.values()];
  out.forEach((p) => p.instances.sort((x, y) => x.start - y.start));
  return out.sort((x, y) => x.sort - y.sort || x.uuid.localeCompare(y.uuid));
};

/** A passage and its stored annotation rows. */
const readPassage = async (passageUuid: string) => {
  const { data: passage, error } = await db()
    .from('passages')
    .select('*')
    .eq('uuid', passageUuid)
    .single();
  fail(`read passage ${passageUuid}`, error);
  const { data: rows, error: rowsError } = await db()
    .from('passage_annotations')
    .select('*')
    .eq('passage_uuid', passageUuid)
    .order('uuid');
  fail(`read annotations of ${passageUuid}`, rowsError);
  return {
    passage: passage as PassageDTO,
    rows: (rows ?? []) as AnnotationDTO[],
  };
};

/**
 * Writes a passage's full annotation state through the editor's save, the
 * one write path for passages.
 */
const saveAnnotations = async (passage: PassageDTO, rows: AnnotationDTO[]) => {
  const result = await savePassagesWithDeletions({
    client: db(),
    passages: [passageFromDTO(passage)],
    rawAnnotations: { [passage.uuid]: rows },
  });
  if (!result.success) {
    throw new Error(`save ${passage.uuid}: ${result.error}`);
  }
};

/**
 * Adds a glossary instance to a test-work passage. The suite's fixture puts
 * the test work's annotations back before each test and after each file.
 */
export const addInstance = async ({
  passageUuid,
  glossaryUuid,
  start,
  end,
  toh = null,
}: {
  passageUuid: string;
  glossaryUuid: string;
  start: number;
  end: number;
  toh?: string | null;
}): Promise<string> => {
  const { data: glossary, error: gError } = await db()
    .from('glossaries')
    .select('authority_uuid')
    .eq('uuid', glossaryUuid)
    .single();
  fail(`read glossary ${glossaryUuid}`, gError);
  const { passage, rows } = await readPassage(passageUuid);
  const uuid = randomUUID();
  const row = {
    uuid,
    passage_uuid: passageUuid,
    type: 'glossary-instance',
    start,
    end,
    toh,
    content: [
      { uuid: glossaryUuid, authority: glossary?.authority_uuid as string },
    ],
  } as unknown as AnnotationDTO;
  await saveAnnotations(passage, [...rows, row]);
  return uuid;
};

/** Removes an annotation added by `addInstance`. */
export const removeAnnotation = async (
  passageUuid: string,
  uuid: string,
): Promise<void> => {
  const { passage, rows } = await readPassage(passageUuid);
  if (!rows.some((r) => r.uuid === uuid)) {
    throw new Error(`annotation ${uuid} is not on passage ${passageUuid}`);
  }
  await saveAnnotations(
    passage,
    rows.filter((r) => r.uuid !== uuid),
  );
};

/** An entry of the work that no passage links to. */
export const unusedEntry = async (
  workUuid: string,
): Promise<{ uuid: string; english: string }> => {
  const { data: terms, error } = await db()
    .from('glossary_term_index')
    .select('glossary_uuid, english')
    .eq('work_uuid', workUuid)
    .order('english');
  fail('read glossary terms', error);
  for (const term of terms ?? []) {
    let linked = false;
    for (const row of await entryRows(term.glossary_uuid as string)) {
      const { count, error: countError } = await db()
        .from('passage_annotations')
        .select('uuid', { count: 'exact', head: true })
        .eq('type', 'glossary-instance')
        .contains('content', JSON.stringify([{ uuid: row }]));
      fail('count glossary instances', countError);
      if (count) linked = true;
    }
    if (!linked && term.english) {
      return { uuid: term.glossary_uuid as string, english: term.english };
    }
  }
  throw new Error('every entry of the work is linked');
};

/** Where `text` occurs in `content`, case-insensitively, after `from`. */
export const indexOfText = (content: string, text: string, from = 0): number =>
  content.toLowerCase().indexOf(text.toLowerCase(), from);

/**
 * Whether a browser request asks for the passages a glossary entry appears
 * in: the excerpts query, the old per-term passages query, or a glossary
 * query that selects a `passages` field.
 */
export const isPassagesRequest = (request: Request): boolean => {
  const body = `${request.url()} ${request.postData() ?? ''}`;
  if (/glossaryTerm(Excerpts|Passages)\b/.test(body)) return true;
  return /glossary/i.test(body) && /\bpassages\s*(\(|\{|\\n|\s)/.test(body);
};
