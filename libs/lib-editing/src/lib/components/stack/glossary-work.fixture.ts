import type {
  DataClient,
  GlossaryEntry,
  GlossaryEntryName,
  GlossaryExcerptsPage,
  GlossaryPassageExcerpt,
  GlossarySaveFailure,
  GlossarySaveResult,
  GlossaryTermNode,
} from '@eightyfourthousand/data-access';

/**
 * A fake glossary for the DEV-883 acceptance specs: the data-access functions
 * the glossary rows read and write through, answering from memory the way the
 * database does (a save is guarded by the definition it was read with).
 *
 * Written from the spec, not the implementation. A spec wires the functions
 * into `jest.mock('@eightyfourthousand/data-access', ...)`, as the other stack
 * specs do, and reaches the fake through a `let` it fills in `beforeEach`.
 */

export const WORK = 'w1';

/** One entry of the fake work, in glossary order. */
export type GlossaryItem = {
  uuid: string;
  termNumber: number;
  definition: string | null;
  english?: string | null;
  names?: GlossaryEntryName[];
};

export const nameOf = (
  glossaryUuid: string,
  language: string,
  content: string,
  extra: Partial<GlossaryEntryName> = {},
): GlossaryEntryName => ({
  glossaryUuid,
  nameUuid: `${glossaryUuid}:${language}:${content}`,
  nameAuthorityUuid: `auth-${glossaryUuid}`,
  language,
  content,
  contentTransformed: null,
  termType: language === 'en' ? 'translationMain' : null,
  attestation: null,
  ...extra,
});

export const entryOf = (item: GlossaryItem): GlossaryEntry => ({
  uuid: item.uuid,
  workUuid: WORK,
  authorityUuid: `auth-${item.uuid}`,
  definition: item.definition,
  definitionRend: null,
  glossMode: 'match',
  names: item.names ?? [
    nameOf(item.uuid, 'en', item.english ?? `term ${item.termNumber}`),
  ],
});

export const nodeOf = (item: GlossaryItem): GlossaryTermNode => ({
  uuid: item.uuid,
  authority: `auth-${item.uuid}`,
  definition: item.definition,
  termNumber: item.termNumber,
  names: {
    english: item.english ?? `term ${item.termNumber}`,
    tibetan: null,
    sanskrit: null,
    pali: null,
    chinese: null,
    wylie: null,
    alternatives: null,
  },
});

/** Items `g1..gN`, numbered from one, with a definition each. */
export const numberedItems = (count: number): GlossaryItem[] =>
  Array.from({ length: count }, (_, i) => ({
    uuid: `g${i + 1}`,
    termNumber: i + 1,
    definition: `<p>Definition ${i + 1}.</p>`,
  }));

export type PageArgs = {
  client?: unknown;
  workUuid: string;
  limit?: number;
  cursor?: string | null;
  direction?: string;
};

export type SaveArgs = {
  client?: unknown;
  workUuid: string;
  before: GlossaryEntry;
  after: { definition?: string | null };
};

/**
 * The fake. Its `jest.fn`s are what a spec hands to `jest.mock`; `stored`
 * holds the entries as the database does, so a spec changes an entry
 * "elsewhere" by writing to it.
 */
export const glossaryFake = (items: GlossaryItem[]) => {
  const order = items.map((item) => item.uuid);
  const stored = new Map(items.map((item) => [item.uuid, entryOf(item)]));
  const state = {
    /** The reason a guarded save is refused with. */
    refusal: 'stale' as string,
    /** Saves in flight at once, and the most there were. */
    inFlight: 0,
    maxInFlight: 0,
  };

  const page = jest.fn(async (args: PageArgs) => {
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    const after = args.cursor ? order.indexOf(args.cursor) + 1 : 0;
    const nodes = items.slice(after, after + limit).map(nodeOf);
    return {
      nodes,
      pageInfo: {
        nextCursor: nodes.length ? nodes[nodes.length - 1].uuid : null,
        prevCursor: null,
        hasMoreAfter: after + nodes.length < items.length,
        hasMoreBefore: after > 0,
      },
      totalCount: items.length,
    };
  });

  const entries = jest.fn(
    async (args: { workUuid: string; uuids: readonly string[] }) =>
      args.uuids.flatMap((uuid) => stored.get(uuid) ?? []),
  );

  const success = (
    saved: GlossaryEntry[],
    deleted: string[] = [],
  ): GlossarySaveResult => ({
    success: true,
    dryRun: false,
    entries: saved,
    deleted,
    changes: {
      glossaries: { inserted: 0, updated: saved.length, deleted: 0 },
      glossaryEdges: { inserted: 0, deleted: 0 },
      names: { inserted: 0, updated: 0 },
      annotations: { deleted: 0 },
    },
  });

  const save = jest.fn(async (args: SaveArgs): Promise<GlossarySaveResult> => {
    state.inFlight += 1;
    state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
    try {
      // Yield, so saves that overlap are seen to.
      await Promise.resolve();
      const current = stored.get(args.before.uuid);
      if (!current) {
        return {
          success: false,
          reason: 'not-found',
          error: 'No such entry',
          outcomeUnknown: false,
        };
      }
      if (current.definition !== args.before.definition) {
        return {
          success: false,
          reason: state.refusal as GlossarySaveFailure,
          error: 'definition of entry has changed',
          outcomeUnknown: false,
        };
      }
      const next =
        args.after.definition === undefined
          ? current
          : { ...current, definition: args.after.definition };
      stored.set(next.uuid, next);
      return success([next]);
    } finally {
      state.inFlight -= 1;
    }
  });

  const read = jest.fn(async (args: { uuid: string }) => {
    const entry = stored.get(args.uuid);
    return entry
      ? { status: 'found' as const, entry }
      : { status: 'not-found' as const };
  });

  const remove = jest.fn(
    async (args: { uuid: string }): Promise<GlossarySaveResult> => {
      if (!stored.delete(args.uuid)) {
        return {
          success: false,
          reason: 'not-found',
          error: 'No such entry',
          outcomeUnknown: false,
        };
      }
      return success([], [args.uuid]);
    },
  );

  /** Passages citing an entry, by entry uuid, for the delete dialog. */
  const citing = new Map<string, GlossaryPassageExcerpt[]>();
  const excerpts = jest.fn(
    async (args: { uuid: string }): Promise<GlossaryExcerptsPage> => {
      const list = citing.get(args.uuid) ?? [];
      return {
        items: list,
        totalCount: list.length,
        nextCursor: null,
        hasMore: false,
      };
    },
  );

  return {
    client: {} as DataClient,
    stored,
    state,
    citing,
    page,
    entries,
    save,
    read,
    remove,
    excerpts,
  };
};

export type GlossaryFake = ReturnType<typeof glossaryFake>;

/** A passage citing an entry, as the delete dialog lists it. */
export const citingPassage = (
  uuid: string,
  label: string,
  instanceCount: number,
): GlossaryPassageExcerpt => ({
  uuid,
  label,
  type: 'translation',
  sort: 1,
  toh: null,
  instanceCount,
  excerpt: {
    text: 'An excerpt of the passage.',
    truncatedStart: false,
    truncatedEnd: false,
    highlights: [],
  },
});

/** A definition's text, the way a reader sees it. */
export const plainText = (html: string | null) =>
  (html ?? '').replace(/<[^>]+>/g, '');
