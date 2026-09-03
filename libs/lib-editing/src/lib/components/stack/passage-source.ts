import type { JSONContent } from '@tiptap/core';
import type { GraphQLClient } from 'graphql-request';
import {
  getPassageMetaPage,
  getTranslationBlocks,
  getTranslationBlocksAround,
} from '@eightyfourthousand/client-graphql';
import {
  PassageLoader,
  type PassageSnapshot,
  type PassageSource,
  type Spine,
  type SpineSeed,
} from '@eightyfourthousand/lib-doc-model';

/** Where a snapshot came from, for the loader's report. */
export const GRAPHQL_SOURCE_NAME = 'api-graphql';

/** The server caps a passage page at 100. */
const MAX_PAGE = 100;

/**
 * The network half of the doc model's loader.
 *
 * `lib-doc-model` declares what a passage source is and knows nothing about
 * where passages live; `lib-persistence` implements the local half. This is the
 * other one, and it lives here rather than in `client-graphql` on purpose:
 * making a thin query client depend on the doc model would pull yjs and
 * ProseMirror into the dependency closure of everything that reads the API, the
 * public reading room included. This package already depends on both, and is
 * where the loader is assembled.
 *
 * Supplies row content rather than encoded documents. A passage that has never
 * been edited has no Yjs document anywhere — the API serves rows — so the doc
 * model seeds one from `content`. Encoded documents come from the local store,
 * and later from the sync path.
 *
 * ## Why this needs the spine
 *
 * `loadPassages` is handed a *set* of uuids, while the server's `passages`
 * connection is positional — a cursor plus a direction. Bridging the two needs
 * the uuid that precedes the requested run, and only the spine knows the order.
 *
 * The alternative was `AROUND` centred on the first wanted passage, which needs
 * no spine but splits its limit half before and half after the cursor: it would
 * fetch roughly twice the window's `json` on every scroll, and `json` is the
 * expensive field. Passing the spine costs nothing here — the caller that
 * builds the loader owns it already — so a source without one falls back to
 * that wider read rather than being the normal path.
 */
export const graphqlPassageSource = ({
  client,
  workUuid,
  spine,
}: {
  client: GraphQLClient;
  /**
   * The work this source answers for. Checked against every call: a source
   * wired to one work silently answering for another would fill a spine with
   * another text's passages.
   */
  workUuid: string;
  /**
   * The work's spine, read to turn a uuid set into a cursor and a span.
   *
   * A function rather than the object, because the loader is constructed before
   * the `WorkDocument` that owns the spine exists.
   */
  spine?: () => Spine | undefined;
}): PassageSource => {
  const wrongWork = (requested: string) => {
    if (requested === workUuid) return false;
    console.error(
      `passage source is wired to work ${workUuid} but was asked for ${requested}`,
    );
    return true;
  };

  /**
   * The cursor and span covering `uuids`, from the spine's ordering.
   *
   * The span is the whole run from the first wanted passage to the last, which
   * may be wider than the set when the caller already holds some of the middle
   * — one request for a contiguous read beats several for the exact set.
   */
  const spanFor = (uuids: string[]) => {
    const current = spine?.();
    if (!current) return null;

    const indices = uuids
      .map((uuid) => current.indexOf(uuid))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b);
    if (!indices.length) return null;

    const start = indices[0];
    const end = indices[indices.length - 1];
    return {
      // The connection's cursor is exclusive, so start from the passage before
      // the run. At the top of the spine there is none loaded — and since a
      // spine can start mid-work after a deep link, that is not the same as
      // the start of the work.
      cursor: start > 0 ? current.uuidAt(start - 1) : undefined,
      first: current.uuidAt(start),
      count: end - start + 1,
    };
  };

  /**
   * Read a run of passages, paging until the whole span is covered.
   *
   * `getTranslationBlocks` is the reader's own fetch, and its blocks already
   * carry what a snapshot needs: identity in `attrs`, children in `content`.
   * Only the children are kept — a passage's identity lives in the spine, so
   * holding it in the document too would be a second copy free to drift.
   */
  const readSpan = async (cursor: string | undefined, count: number) => {
    const found: PassageSnapshot[] = [];
    let next = cursor;
    let remaining = count;

    while (remaining > 0) {
      const page = await getTranslationBlocks({
        client,
        uuid: workUuid,
        cursor: next,
        maxPassages: Math.min(remaining, MAX_PAGE),
      });
      const blocks = Array.isArray(page.blocks)
        ? page.blocks
        : [page.blocks].filter(Boolean);
      if (!blocks.length) break;

      blocks.forEach((block) => {
        const uuid = block?.attrs?.uuid;
        if (!uuid) return;
        found.push({
          uuid,
          content: (block.content ?? []) as JSONContent[],
        });
      });
      remaining -= blocks.length;
      if (!page.hasMoreAfter || !page.nextCursor) break;
      next = page.nextCursor;
    }

    return found;
  };

  /**
   * Read a run that begins at the top of the spine.
   *
   * There is no loaded passage before it to use as an exclusive cursor, and
   * assuming the start of the work would be wrong for a spine that opened
   * around a deep link. `AROUND` includes its own cursor, which is the row
   * that would otherwise be missed; the rest of the run continues forward.
   */
  const readFrom = async (first: string, count: number) => {
    const page = await getTranslationBlocksAround({
      client,
      uuid: workUuid,
      passageUuid: first,
      maxPassages: Math.min(MAX_PAGE, Math.max(count * 2, 2)),
    });
    const blocks = Array.isArray(page.blocks)
      ? page.blocks
      : [page.blocks].filter(Boolean);

    const found: PassageSnapshot[] = [];
    blocks.forEach((block) => {
      const uuid = block?.attrs?.uuid;
      if (!uuid) return;
      found.push({ uuid, content: (block.content ?? []) as JSONContent[] });
    });

    // `AROUND` splits its limit either side of the cursor, so a long run needs
    // the remainder read forward from where it stopped.
    const covered = found.findIndex((snapshot) => snapshot.uuid === first);
    const after = covered >= 0 ? found.length - covered : 0;
    if (after < count && page.hasMoreAfter && page.nextCursor) {
      found.push(...(await readSpan(page.nextCursor, count - after)));
    }
    return found;
  };

  return {
    name: GRAPHQL_SOURCE_NAME,

    async loadPassages(
      requestedWorkUuid: string,
      uuids: string[],
    ): Promise<PassageSnapshot[]> {
      if (wrongWork(requestedWorkUuid) || !uuids.length) return [];

      const span = spanFor(uuids);
      const wanted = new Set(uuids);

      // Without a spine there is no cursor to derive, so fall back to reading
      // from the start of the work in pages until the wanted set is covered.
      // Correct but wasteful; the assembled loader always supplies a spine.
      const found = !span
        ? await readSpan(undefined, MAX_PAGE)
        : span.cursor
          ? await readSpan(span.cursor, span.count)
          : span.first
            ? await readFrom(span.first, span.count)
            : await readSpan(undefined, MAX_PAGE);

      // Passages pulled in because they sat inside the run are dropped: the
      // loader treats anything returned as answered, and a passage the caller
      // did not ask for is one it already holds.
      return found.filter((snapshot) => wanted.has(snapshot.uuid));
    },

    /**
     * The *first* page of the work's passages, not all of them.
     *
     * `PassageSource` declares this as the work's metadata, and for a short
     * work that is what comes back. For a long one it is a prefix: seeding a
     * complete spine costs one request per hundred passages, and production's
     * largest works are 15,904 and 15,357. `SpineFeed` appends the rest as the
     * reader reaches them.
     */
    async loadSpineMetas(requestedWorkUuid: string): Promise<SpineSeed[]> {
      if (wrongWork(requestedWorkUuid)) return [];

      const page = await getPassageMetaPage({ client, uuid: workUuid });
      // Server order is the spine's order: `sort` is sparse and not an index,
      // so position is what carries it.
      return page.metas.map(({ uuid, label, type, toh }) => ({
        uuid,
        label,
        type,
        toh,
      }));
    },
  };
};

/**
 * The loader a stack reads through: local store first, API behind it.
 *
 * Order is the point — the local source answers from disk and whatever it
 * cannot answer falls through to the network, whose snapshots are written back
 * so the next visit does not need it. Passing no local source is valid and
 * means every window comes from the API; that is the sandbox's configuration,
 * and the studio's until `lib-persistence` is wired in.
 */
export const createStackLoader = ({
  client,
  workUuid,
  spine,
  local,
  cache,
  buffer,
}: {
  client: GraphQLClient;
  workUuid: string;
  spine?: () => Spine | undefined;
  /** `localPassageSource(storage)` from `lib-persistence`, when available. */
  local?: PassageSource;
  /** `cachePassageSnapshots(storage)` from `lib-persistence`. */
  cache?: (workUuid: string, snapshots: PassageSnapshot[]) => Promise<void>;
  /** Passages either side of the visible range to hydrate. */
  buffer?: number;
}): PassageLoader =>
  new PassageLoader({
    sources: [
      ...(local ? [local] : []),
      graphqlPassageSource({ client, workUuid, spine }),
    ],
    cache,
    buffer,
  });
