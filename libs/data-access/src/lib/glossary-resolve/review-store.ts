import type { DataClient } from '../types';
import { planGlossaryInstances, type GlossaryPlan } from './plan';
import { triageReview, type ReviewTriage } from './review';
import { orderBatches, sanitizeBatch, type ReviewBatch } from './review-batch';
import { contextOf } from './text';

/**
 * Private bucket of review records, append-only to users: reading needs
 * `editor.read`, adding an object `editor.edit`, and nothing may be replaced or
 * removed. Each record call adds one batch, so concurrent reviewers never
 * overwrite each other.
 */
export const GLOSSARY_REVIEWS_BUCKET = 'glossary-reviews';

const LIST_LIMIT = 1000;
const READ_CONCURRENCY = 8;
const SIGNED_URL_SECONDS = 60 * 60;

const stamp = (iso: string) => iso.replace(/[:.]/g, '-');

export const reviewBatchPath = (
  batch: Pick<ReviewBatch, 'workUuid' | 'recordedAt' | 'batchId'>,
) =>
  `${batch.workUuid}/decisions/${stamp(batch.recordedAt)}-${batch.batchId}.json`;

const isBatch = (value: unknown, workUuid: string): value is ReviewBatch => {
  const b = value as ReviewBatch;
  return (
    !!b &&
    b.version === 1 &&
    b.workUuid === workUuid &&
    typeof b.batchId === 'string' &&
    typeof b.recordedAt === 'string' &&
    (b.decider === 'model' || b.decider === 'editor') &&
    Array.isArray(b.rules) &&
    Array.isArray(b.instances) &&
    Array.isArray(b.additions)
  );
};

/** Every review batch recorded for a work, in recorded order. Unreadable objects are reported, not used. */
export const readReviewBatches = async ({
  client,
  workUuid,
}: {
  client: DataClient;
  workUuid: string;
}): Promise<
  { batches: ReviewBatch[]; warnings: string[] } | { error: string }
> => {
  const bucket = client.storage.from(GLOSSARY_REVIEWS_BUCKET);
  const prefix = `${workUuid}/decisions`;
  const names: string[] = [];
  for (let offset = 0; ; offset += LIST_LIMIT) {
    const { data, error } = await bucket.list(prefix, {
      limit: LIST_LIMIT,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error)
      return { error: `Could not list review decisions: ${error.message}` };
    names.push(...(data ?? []).filter((e) => e.id !== null).map((e) => e.name));
    if ((data ?? []).length < LIST_LIMIT) break;
  }

  const batches: ReviewBatch[] = [];
  const warnings: string[] = [];
  for (let i = 0; i < names.length; i += READ_CONCURRENCY) {
    const read = await Promise.all(
      names.slice(i, i + READ_CONCURRENCY).map(async (name) => {
        const { data, error } = await bucket.download(`${prefix}/${name}`);
        if (error || !data) return { name, error: error?.message ?? 'empty' };
        try {
          return { name, value: JSON.parse(await data.text()) as unknown };
        } catch {
          return { name, error: 'not JSON' };
        }
      }),
    );
    for (const r of read) {
      // A batch that cannot be read makes every later decision suspect, so the
      // read fails rather than silently dropping someone's decisions.
      if ('error' in r)
        return { error: `Could not read review batch ${r.name}: ${r.error}` };
      if (!isBatch(r.value, workUuid)) {
        warnings.push(`Ignored ${r.name}: not a review batch of this work.`);
        continue;
      }
      const { batch, dropped } = sanitizeBatch(r.value);
      if (dropped)
        warnings.push(`Ignored ${dropped} malformed entries in ${r.name}.`);
      batches.push(batch);
    }
  }
  return { batches: orderBatches(batches), warnings };
};

/** Adds a batch. Never replaces one: a name collision fails. */
export const writeReviewBatch = async ({
  client,
  batch,
}: {
  client: DataClient;
  batch: ReviewBatch;
}): Promise<{ path: string } | { error: string }> => {
  const path = reviewBatchPath(batch);
  const { error } = await client.storage
    .from(GLOSSARY_REVIEWS_BUCKET)
    .upload(
      path,
      new Blob([JSON.stringify(batch)], { type: 'application/json' }),
      {
        contentType: 'application/json',
        upsert: false,
      },
    );
  if (error) return { error: `Could not record the review: ${error.message}` };
  return { path };
};

/** Stores a new file under the work's folder and returns a signed URL to it. */
export const writeReviewFile = async ({
  client,
  workUuid,
  folder,
  body,
  contentType,
}: {
  client: DataClient;
  workUuid: string;
  folder: 'candidates' | 'applied';
  body: string;
  contentType: 'application/json' | 'text/tab-separated-values';
}): Promise<
  { path: string; url?: string; urlError?: string } | { error: string }
> => {
  const bucket = client.storage.from(GLOSSARY_REVIEWS_BUCKET);
  const extension = contentType === 'application/json' ? 'json' : 'tsv';
  const path = `${workUuid}/${folder}/${stamp(new Date().toISOString())}-${crypto.randomUUID()}.${extension}`;
  const { error } = await bucket.upload(
    path,
    new Blob([body], { type: contentType }),
    {
      contentType,
      upsert: false,
    },
  );
  if (error) return { error: `Could not store ${path}: ${error.message}` };
  const signed = await bucket.createSignedUrl(path, SIGNED_URL_SECONDS);
  if (signed.error || !signed.data)
    return {
      path,
      urlError: `Stored, but could not sign a URL: ${signed.error?.message ?? 'no URL'}`,
    };
  return { path, url: signed.data.signedUrl };
};

const TSV_COLUMNS = [
  'key',
  'state',
  'status',
  'reason',
  'tier',
  'passage',
  'label',
  'term',
  'english',
  'text',
  'start',
  'end',
  'decider',
  'context',
  'passage_uuid',
  'term_uuid',
] as const;

const cell = (value: unknown) =>
  value === undefined || value === null
    ? ''
    : String(value).replace(/[\t\r\n]+/g, ' ');

/** Every reviewed item as TSV, citing passages and terms by snapshot anchor. */
export const reviewTsv = (plan: GlossaryPlan, triage: ReviewTriage): string => {
  const passages = new Map(plan.input.passages.map((p) => [p.uuid, p]));
  const english = new Map(plan.input.terms.map((t) => [t.uuid, t.english]));
  const rows = triage.items.map((item) => {
    const passage = passages.get(item.passageUuid);
    return [
      item.key,
      item.state,
      item.match?.status ?? 'added',
      item.match?.reason,
      item.match?.tier,
      plan.anchors.get(item.passageUuid),
      passage?.label,
      plan.anchors.get(item.termUuid),
      english.get(item.termUuid),
      item.text,
      item.start,
      item.end,
      item.decider,
      contextOf(passage?.content ?? '', item.start, item.end, 60),
      item.passageUuid,
      item.termUuid,
    ]
      .map(cell)
      .join('\t');
  });
  return [TSV_COLUMNS.join('\t'), ...rows].join('\n') + '\n';
};

/** A work's plan with every recorded decision applied to it. */
export interface GlossaryReview {
  plan: GlossaryPlan;
  batches: ReviewBatch[];
  triage: ReviewTriage;
  warnings: string[];
}

/** Plans a work and applies its recorded review decisions. */
export const loadGlossaryReview = async ({
  client,
  workUuid,
}: {
  client: DataClient;
  workUuid: string;
}): Promise<{ data: GlossaryReview } | { error: string }> => {
  const [plan, read] = await Promise.all([
    planGlossaryInstances({ client, workUuid }),
    readReviewBatches({ client, workUuid }),
  ]);
  if ('error' in plan) return plan;
  if ('error' in read) return read;
  return {
    data: {
      plan: plan.data,
      batches: read.batches,
      triage: triageReview({
        plan: plan.data,
        batches: read.batches,
      }),
      warnings: read.warnings,
    },
  };
};
