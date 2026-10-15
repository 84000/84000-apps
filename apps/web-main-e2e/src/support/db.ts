import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { localStack, TEST_WORK } from './local-stack';

export type StoredPassage = {
  uuid: string;
  label: string;
  sort: number;
  type: string;
  toh: string | null;
  content: string;
};

export type StoredAnnotation = {
  uuid: string;
  passage_uuid: string;
  type: string;
  start: number;
  end: number;
  toh: string | null;
  content: unknown;
};

let client: SupabaseClient | undefined;

/** A service-role client for the local stack: test assertions read past RLS. */
export const db = (): SupabaseClient => {
  if (!client) {
    const { apiUrl, serviceRoleKey } = localStack();
    client = createClient(apiUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
};

const fail = (what: string, error: { message: string } | null) => {
  if (error) throw new Error(`${what}: ${error.message}`);
};

/** Every passage of the test work, in sort order. */
export const workPassages = async (): Promise<StoredPassage[]> => {
  const { data, error } = await db()
    .from('passages')
    .select('uuid, label, sort, type, toh, content')
    .eq('work_uuid', TEST_WORK.uuid)
    .order('sort')
    .order('uuid')
    .limit(1000);
  fail('read passages', error);
  return data ?? [];
};

/** The passage with this uuid, or null once it is deleted. */
export const passageByUuid = async (
  uuid: string,
): Promise<StoredPassage | null> => {
  const { data, error } = await db()
    .from('passages')
    .select('uuid, label, sort, type, toh, content')
    .eq('uuid', uuid)
    .maybeSingle();
  fail(`read passage ${uuid}`, error);
  return data;
};

/** Every row the work's passages and annotations hold, for exact comparison. */
export const workSnapshot = async (): Promise<{
  passages: Record<string, unknown>[];
  annotations: Record<string, unknown>[];
}> => {
  const { data: passages, error } = await db()
    .from('passages')
    .select('*')
    .eq('work_uuid', TEST_WORK.uuid)
    .order('uuid')
    .limit(1000);
  fail('read passages', error);
  const uuids = (passages ?? []).map((p) => p.uuid as string);
  const annotations: Record<string, unknown>[] = [];
  // Small batches keep the `in` filter inside URL length limits.
  for (let i = 0; i < uuids.length; i += 50) {
    const { data, error: annError } = await db()
      .from('passage_annotations')
      .select('*')
      .in('passage_uuid', uuids.slice(i, i + 50))
      .order('uuid');
    fail('read annotations', annError);
    annotations.push(...(data ?? []));
  }
  return { passages: passages ?? [], annotations };
};

/** The passage with this label (and Toh, for per-Toh variants). */
export const passageByLabel = async (
  label: string,
  toh?: string,
): Promise<StoredPassage> => {
  let query = db()
    .from('passages')
    .select('uuid, label, sort, type, toh, content')
    .eq('work_uuid', TEST_WORK.uuid)
    .eq('label', label);
  if (toh) query = query.eq('toh', toh);
  const { data, error } = await query;
  fail(`read passage ${label}`, error);
  if (data?.length !== 1) {
    throw new Error(`expected one passage ${label}, found ${data?.length}`);
  }
  return data[0];
};

/** A passage's annotations, ordered by start, then type. */
export const annotationsOf = async (
  passageUuid: string,
): Promise<StoredAnnotation[]> => {
  const { data, error } = await db()
    .from('passage_annotations')
    .select('uuid, passage_uuid, type, start, end, toh, content')
    .eq('passage_uuid', passageUuid)
    .order('start')
    .order('type');
  fail('read annotations', error);
  return data ?? [];
};

/** The text an annotation covers in its passage. */
export const coveredText = (
  passage: Pick<StoredPassage, 'content'>,
  annotation: Pick<StoredAnnotation, 'start' | 'end'>,
): string => passage.content.slice(annotation.start, annotation.end);

/**
 * An annotation's identity without its row uuid, for comparing what a save
 * kept against what was seeded.
 */
export const annotationShape = (
  passage: Pick<StoredPassage, 'content'>,
  a: StoredAnnotation,
) => ({
  type: a.type,
  text: coveredText(passage, a),
  toh: a.toh,
});
