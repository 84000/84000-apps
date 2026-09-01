import {
  DataClient,
  Imprint,
  LANGUAGES,
  SemVer,
  TranslationLanguage,
  tocFromDTO,
} from './types';
import {
  DEFAULT_CONTENT_SOURCE,
  rpcFor,
  type ContentSource,
} from './content-source';

export const getTranslationToc = async ({
  client,
  uuid,
  source = DEFAULT_CONTENT_SOURCE,
}: {
  client: DataClient;
  uuid: string;
  source?: ContentSource;
}) => {
  const { data, error } = await client.rpc(rpcFor('workToc', source), {
    work_uuid_input: uuid,
  });

  if (error) {
    console.error('Error fetching TOC:', error);
    return undefined;
  }

  return tocFromDTO(data || []);
};

export type ImprintKey = { uuid: string; toh: string };

export const imprintKey = ({ uuid, toh }: ImprintKey) => `${uuid}:${toh}`;

/** Title types the imprint projects into `mainTitles`, `longTitles` and `toh`. */
const MAIN_TITLE = 'eft:mainTitle';
const LONG_TITLE = 'eft:longTitle';
const TOH_TITLE = 'eft:toh';
const IMPRINT_TITLE_TYPES = [MAIN_TITLE, LONG_TITLE, TOH_TITLE];

/** `catalog_names` types its rows without the `eft:` prefix `titles` carries. */
const SECTION_NAME_TYPE = 'mainTitle';
const SECTION_NAME_LANGUAGE = 'en';

/**
 * Creator roles the imprint credits, and the language each falls back to when
 * the creator carries no name of its own. Authors are credited in English,
 * translators in Tibetan — an asymmetry inherited from the imprint as published.
 */
const CREDIT_FALLBACK_LANGUAGE = {
  tibetanAuthor: 'en',
  tibetanTranslator: 'bo',
} as const;

type CreditRole = keyof typeof CREDIT_FALLBACK_LANGUAGE;

const CONTESTED = 'contested';

/**
 * The work row, its tohs, and the version currently live for readers.
 *
 * `publisher` and `license` are plain uuid columns with no foreign key to
 * `settings`, so they cannot be embedded and are resolved by a second read.
 * `work_versions` is embedded through the composite
 * `(published_version_uuid, uuid)` key, which matches at most one row.
 */
const WORK_COLUMNS = `
  uuid,
  publicationDate,
  publicationVersion,
  restriction,
  publisher,
  license,
  work_toh(toh_clean),
  work_versions!works_published_version_uuid_fkey(version)`;

type WorkRow = {
  uuid: string;
  publicationDate: string | null;
  publicationVersion: string | null;
  restriction: boolean | null;
  publisher: string | null;
  license: string | null;
  work_toh: { toh_clean: string | null }[];
  work_versions: { version: string | null } | null;
};

/** Publisher statement and license, both rows of the `settings` table. */
const SETTING_COLUMNS = 'uuid, name, description, link';

type SettingRow = {
  uuid: string;
  name: string | null;
  description: string | null;
  link: string | null;
};

const TITLE_COLUMNS =
  'work_uuid, type, language, catalogue_work_xmlid, content';

type TitleRow = {
  work_uuid: string;
  type: string;
  language: string | null;
  catalogue_work_xmlid: string | null;
  content: string | null;
};

/** `source_description` lives on the work-level folio annotation for a toh. */
const SOURCE_DESCRIPTION_COLUMNS = 'work_uuid, toh, source_description';

type SourceDescriptionRow = {
  work_uuid: string;
  toh: string | null;
  source_description: string | null;
};

/**
 * A credited creator with both name sources: the one it points at directly, and
 * every name on its authority so the language fallback can be applied. Both
 * embeds hang off `creators`, so the specific name needs an explicit foreign key
 * hint to disambiguate it from the authority's names.
 */
const CREDIT_COLUMNS = `
  work_uuid,
  type,
  status,
  names!creators_name_uuid_fkey(content),
  authorities(names(language, content))`;

type CreditRow = {
  work_uuid: string;
  type: string;
  status: string | null;
  names: { content: string | null } | null;
  authorities: { names: { language: string | null; content: string | null }[] } | null;
};

/**
 * The catalog section a toh sits in, named by its English main title.
 *
 * `catalog_names` is reached through `catalogs` because that is the table both
 * it and `catalog_works.section_uuid` point at.
 */
const SECTION_COLUMNS = 'work_uuid, toh, catalogs(catalog_names(content))';

type SectionRow = {
  work_uuid: string;
  toh: string | null;
  catalogs: { catalog_names: { content: string | null }[] } | null;
};

/**
 * How many work uuids to name in a single `in.(...)` filter.
 *
 * PostgREST rejects a request whose URL exceeds roughly 16KB, and a uuid costs
 * 37 characters in the list — so a few hundred works is the ceiling, well below
 * the thousands a full-library imprint read carries. Matches the batch size the
 * passage reads already use.
 */
const WORK_UUID_BATCH_SIZE = 200;

/**
 * How many rows to ask for at once.
 *
 * PostgREST caps a response at 1000 rows and says nothing about having done so,
 * so a read that does not page silently loses whatever sits past the cap. A
 * batch of works carries several thousand titles, well over it.
 */
const PAGE_SIZE = 1000;

type Read<T> = { rows: T[]; error: unknown };

/**
 * A built query, before a row range is asked of it. Every read here needs a
 * total ordering so that paging cannot skip or repeat a row.
 */
type PagedQuery<T> = {
  range: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>;
};

/** Page a read to exhaustion, concatenating the rows. */
const readPages = async <T>(query: () => PagedQuery<T>): Promise<Read<T>> => {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query().range(from, from + PAGE_SIZE - 1);

    if (error) {
      return { rows, error };
    }

    const page = data ?? [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      return { rows, error: null };
    }
  }
};

/**
 * Run a read once per batch of work uuids and concatenate the rows.
 *
 * Ordering applies within a batch, which is all the assembly needs: every row
 * for a given work lands in the same batch, because the batches are cut by work.
 */
const readByWork = async <T>(
  workUuids: readonly string[],
  read: (batch: string[]) => PagedQuery<T>,
): Promise<Read<T>> => {
  const rows: T[] = [];

  for (let i = 0; i < workUuids.length; i += WORK_UUID_BATCH_SIZE) {
    const batch = workUuids.slice(i, i + WORK_UUID_BATCH_SIZE);
    const { rows: page, error } = await readPages(() => read(batch));

    if (error) {
      return { rows, error };
    }

    rows.push(...page);
  }

  return { rows, error: null };
};

const groupByWork = <T extends { work_uuid: string }>(
  rows: readonly T[],
): Map<string, T[]> => {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const existing = grouped.get(row.work_uuid);
    if (existing) {
      existing.push(row);
    } else {
      grouped.set(row.work_uuid, [row]);
    }
  }
  return grouped;
};

/**
 * A title belongs to a toh when it either names the work as a whole
 * (`catalogue_work_xmlid` unset) or names that toh specifically.
 */
const titleAppliesToToh = (row: TitleRow, toh: string) =>
  row.catalogue_work_xmlid === null || row.catalogue_work_xmlid === toh;

/**
 * Project the work's titles of one type into a map keyed by language.
 *
 * `rows` arrives ordered by content descending, so the first match for a
 * language is the one the imprint has always shown.
 */
const titlesByLanguage = (
  rows: readonly TitleRow[],
  type: string,
): Partial<{ [key in TranslationLanguage]: string }> => {
  const titles: Partial<{ [key in TranslationLanguage]: string }> = {};

  for (const language of LANGUAGES) {
    const match = rows.find(
      (row) => row.type === type && row.language === language,
    );
    if (match?.content) {
      titles[language] = match.content;
    }
  }

  return titles;
};

/**
 * The names credited for one role, deduplicated and ordered.
 *
 * A creator's own name wins; without one, the first of its authority's names in
 * the role's fallback language stands in.
 */
const creditedNames = (
  rows: readonly CreditRow[],
  role: CreditRole,
): string[] => {
  const fallbackLanguage = CREDIT_FALLBACK_LANGUAGE[role];
  const names = new Set<string>();

  for (const row of rows) {
    if (row.type !== role) {
      continue;
    }

    const fallback = (row.authorities?.names ?? [])
      .filter(
        (name): name is { language: string | null; content: string } =>
          name.language === fallbackLanguage && !!name.content,
      )
      .map(({ content }) => content)
      .sort()[0];

    const name = row.names?.content ?? fallback;
    if (name) {
      names.add(name);
    }
  }

  return [...names].sort();
};

/** The publication year, read off the ISO date rather than parsed as a date. */
const publishYearOf = (publicationDate: string | null) =>
  publicationDate?.slice(0, 4) || undefined;

/**
 * Build one imprint from the rows read for its work, narrowed to its toh.
 *
 * Every read covers the whole batch, so each field is selected from the work's
 * rows here rather than filtered in the query.
 */
const assembleImprint = ({
  key,
  work,
  settings,
  titles,
  sourceDescriptions,
  credits,
  sections,
}: {
  key: ImprintKey;
  work: WorkRow;
  settings: Map<string, SettingRow>;
  titles: readonly TitleRow[];
  sourceDescriptions: readonly SourceDescriptionRow[];
  credits: readonly CreditRow[];
  sections: readonly SectionRow[];
}): Imprint => {
  const { uuid, toh } = key;
  const applicable = titles.filter((row) => titleAppliesToToh(row, toh));

  // The annotation records the toh without its `toh` prefix.
  const tohNumber = toh.replace(/^toh/, '');
  const sourceDescription = sourceDescriptions.find(
    (row) => row.toh === tohNumber,
  )?.source_description;

  const section = sections.find((row) => row.toh === toh)?.catalogs
    ?.catalog_names[0]?.content;

  const publisher = work.publisher
    ? settings.get(work.publisher)
    : undefined;
  const license = work.license ? settings.get(work.license) : undefined;

  const version = work.work_versions?.version ?? work.publicationVersion;

  return {
    uuid,
    // The imprint shows the toh as its `eft:toh` title renders it ("Toh 312"),
    // not as the slug. Callers fall back to the slug when the title is absent.
    toh: applicable.find(
      (row) => row.type === TOH_TITLE && row.language === 'en',
    )?.content as string,
    section: section ?? undefined,
    // The column is free text; the domain narrows it to a semver.
    version: (version as SemVer) ?? undefined,
    restriction: work.restriction ?? undefined,
    publishYear: publishYearOf(work.publicationDate),
    tibetanAuthors: creditedNames(credits, 'tibetanAuthor'),
    isAuthorContested: credits.some(
      (row) => row.type === 'tibetanAuthor' && row.status === CONTESTED,
    ),
    sourceDescription: sourceDescription ?? undefined,
    publisherStatement: publisher?.description ?? undefined,
    // The domain keeps translators as the joined string the imprint prints.
    tibetanTranslators: creditedNames(credits, 'tibetanTranslator').join(', '),
    license: {
      name: license?.name ?? undefined,
      description: license?.description ?? undefined,
      link: license?.link ?? undefined,
    },
    mainTitles: titlesByLanguage(applicable, MAIN_TITLE),
    longTitles: titlesByLanguage(applicable, LONG_TITLE),
  };
};

/**
 * Read the imprints for a set of (work, toh) pairs, keyed by {@link imprintKey}.
 *
 * Assembles the imprint here rather than through the `get_imprints` RPC. That
 * function fanned a ten-way join out per pair and collapsed it with `max()`
 * aggregates, so its cost was linear in the batch — about 3.4ms per imprint
 * against production, or ~16s to read the whole library. These reads are
 * set-based instead: six of them, each covering the whole batch, so the cost
 * barely moves with batch size.
 *
 * A pair with no work row, or whose toh the work does not carry, is absent from
 * the returned map.
 *
 * Imprints are unversioned, so there is no published/draft variant to resolve.
 */
export const getTranslationImprints = async ({
  client,
  keys,
}: {
  client: DataClient;
  keys: readonly ImprintKey[];
}): Promise<Map<string, Imprint>> => {
  const imprintsByKey = new Map<string, Imprint>();
  if (keys.length === 0) {
    return imprintsByKey;
  }

  const workUuids = [...new Set(keys.map(({ uuid }) => uuid))];

  const reads = await Promise.all([
    readByWork<WorkRow>(workUuids, (batch) =>
      client
        .from('works')
        .select<string, WorkRow>(WORK_COLUMNS)
        .in('uuid', batch)
        .order('uuid', { ascending: true }),
    ),
    readByWork<TitleRow>(workUuids, (batch) =>
      client
        .from('titles')
        .select<string, TitleRow>(TITLE_COLUMNS)
        .in('work_uuid', batch)
        .in('type', IMPRINT_TITLE_TYPES)
        // The imprint has always shown the greatest title content per slot, an
        // artifact of the `max()` the RPC aggregated with. Order here so the
        // tie-break stays the database's rather than JavaScript's, then by uuid
        // so the order is total and the read can be paged.
        .order('content', { ascending: false, nullsFirst: false })
        .order('uuid', { ascending: true }),
    ),
    readByWork<SourceDescriptionRow>(workUuids, (batch) =>
      client
        .from('folio_annotations')
        .select<string, SourceDescriptionRow>(SOURCE_DESCRIPTION_COLUMNS)
        .in('work_uuid', batch)
        .eq('annotation_type', 'work')
        .order('source_description', { ascending: false, nullsFirst: false })
        .order('uuid', { ascending: true }),
    ),
    readByWork<CreditRow>(workUuids, (batch) =>
      client
        .from('creators')
        .select<string, CreditRow>(CREDIT_COLUMNS)
        .in('work_uuid', batch)
        .in('type', Object.keys(CREDIT_FALLBACK_LANGUAGE))
        .order('uuid', { ascending: true }),
    ),
    readByWork<SectionRow>(workUuids, (batch) =>
      client
        .from('catalog_works')
        .select<string, SectionRow>(SECTION_COLUMNS)
        .in('work_uuid', batch)
        .eq('catalogs.catalog_names.language', SECTION_NAME_LANGUAGE)
        .eq('catalogs.catalog_names.type', SECTION_NAME_TYPE)
        .order('uuid', { ascending: true }),
    ),
    // Publisher and license are rows of `settings`, a handful of configuration
    // rows. Reading it whole keeps it out of the batched, work-keyed reads.
    readPages<SettingRow>(() =>
      client
        .from('settings')
        .select<string, SettingRow>(SETTING_COLUMNS)
        .order('uuid', { ascending: true }),
    ),
  ]);

  const failed = reads.find(({ error }) => error);
  if (failed) {
    console.error('Error batch fetching imprints:', failed.error);
    return imprintsByKey;
  }

  const [works, titles, sourceDescriptions, credits, sections, settingRows] =
    reads;

  const settings = new Map(settingRows.rows.map((row) => [row.uuid, row]));
  const worksByUuid = new Map(works.rows.map((work) => [work.uuid, work]));
  const titlesByWork = groupByWork(titles.rows);
  const sourceDescriptionsByWork = groupByWork(sourceDescriptions.rows);
  const creditsByWork = groupByWork(credits.rows);
  const sectionsByWork = groupByWork(sections.rows);

  for (const key of keys) {
    const work = worksByUuid.get(key.uuid);
    if (!work?.work_toh.some(({ toh_clean }) => toh_clean === key.toh)) {
      continue;
    }

    imprintsByKey.set(
      imprintKey(key),
      assembleImprint({
        key,
        work,
        settings,
        titles: titlesByWork.get(key.uuid) ?? [],
        sourceDescriptions: sourceDescriptionsByWork.get(key.uuid) ?? [],
        credits: creditsByWork.get(key.uuid) ?? [],
        sections: sectionsByWork.get(key.uuid) ?? [],
      }),
    );
  }

  return imprintsByKey;
};

/** Read the imprint for a single (work, toh) pair. */
export const getTranslationImprint = async ({
  client,
  uuid,
  toh,
}: {
  client: DataClient;
  uuid: string;
  toh: string;
}): Promise<Imprint | undefined> => {
  const imprints = await getTranslationImprints({
    client,
    keys: [{ uuid, toh }],
  });

  return imprints.get(imprintKey({ uuid, toh }));
};
