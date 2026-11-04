import { DataClient } from '../types';
import { DEFAULT_CONTENT_SOURCE, type ContentSource } from '../content-source';
import { getGlossaryTermPassagesPage } from './pagination';

/**
 * Short passages of text around a glossary term's uses in its work.
 *
 * Built on the citing-passages read the reader's glossary uses, which finds the
 * passages carrying a glossary-instance annotation for the term. Each use is cut
 * down to a window either side, with the term itself marked «like this», so a
 * caller can judge the sense the work uses it in without reading whole passages.
 *
 * Only a term (the entry with the glossary's own name) has instances. An entry
 * that is a child name, or a work whose instances have not been resolved yet,
 * returns no contexts; fall back to a text search for the term.
 */

export const DEFAULT_CONTEXT_LIMIT = 5;
export const DEFAULT_CONTEXT_WINDOW = 250;

export type GlossaryTermContext = {
  passageUuid: string;
  label: string;
  snippets: string[];
};

export type GlossaryTermContexts = {
  glossaryUuid: string;
  contexts: GlossaryTermContext[];
  hasMore: boolean;
};

type InstanceLike = {
  type: string;
  start: number;
  end: number;
  glossary?: string;
};

const clip = (content: string, start: number, end: number, window: number) => {
  const from = Math.max(0, start - window);
  const to = Math.min(content.length, end + window);
  return (
    (from > 0 ? '…' : '') +
    content.slice(from, start) +
    '«' +
    content.slice(start, end) +
    '»' +
    content.slice(end, to) +
    (to < content.length ? '…' : '')
  );
};

export const getGlossaryTermContexts = async ({
  client,
  glossaryUuid,
  limit = DEFAULT_CONTEXT_LIMIT,
  window = DEFAULT_CONTEXT_WINDOW,
  source = DEFAULT_CONTENT_SOURCE,
}: {
  client: DataClient;
  glossaryUuid: string;
  /** Passages to return. */
  limit?: number;
  /** Characters of text kept either side of each use. */
  window?: number;
  source?: ContentSource;
}): Promise<GlossaryTermContexts> => {
  const page = await getGlossaryTermPassagesPage({
    client,
    uuid: glossaryUuid,
    first: limit,
    source,
  });

  const contexts = page.items.map((passage) => {
    const content = passage.content ?? '';
    const uses = ((passage.annotations ?? []) as unknown as InstanceLike[])
      .filter(
        (a) =>
          a.type === 'glossaryInstance' &&
          a.glossary === glossaryUuid &&
          a.end > a.start,
      )
      .sort((a, b) => a.start - b.start);

    const snippets = uses.length
      ? uses.map((use) => clip(content, use.start, use.end, window))
      : // The read found the passage by its annotation but did not carry it.
        [
          content.length > window * 2
            ? content.slice(0, window * 2) + '…'
            : content,
        ];

    return { passageUuid: passage.uuid, label: passage.label, snippets };
  });

  return { glossaryUuid, contexts, hasMore: page.hasMore };
};
